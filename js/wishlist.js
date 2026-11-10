// Wunschliste mit drei Reitern: Kartenliste (alle Karten, ★ zum Wünschen), Wunschliste
// (gewünschte Karten, älteste zuerst) und Einkaufshilfe (Booster-Vorschläge aus den Wunschkarten).
// Gespeichert als [[Karten-id, Zeitpunkt], …] im Browser, auf claude.ai zusätzlich online.

const WISH_KEY = STORAGE_KEY + ".wunsch";
const DB_WISH = "wunsch";
let wishlist = new Map();  // Karten-id -> Zeitpunkt des Wünschens (ms, 0 = unbekannt)
let wishDb = null;

// Nimmt alte Listen (nur ids) und neue ([id, t] oder {id, t}) an.
function cleanWish(raw) {
  const out = new Map();
  for (const x of Array.isArray(raw) ? raw : []) {
    const [id, at] = typeof x === "string" ? [x, 0] : Array.isArray(x) ? x : [x?.id, x?.t];
    if (typeof id === "string" && id) out.set(id, Number(at) || 0);
  }
  return out;
}
const isWished = id => wishlist.has(id);
const wishEntries = () => [...wishlist].map(([id, at]) => ({ id, t: at }));

function saveWishLocal() {
  try { localStorage.setItem(WISH_KEY, JSON.stringify([...wishlist])); } catch { /* privater Modus o. ä. */ }
}
function loadWishLocal() {
  try { wishlist = cleanWish(JSON.parse(localStorage.getItem(WISH_KEY))); } catch { wishlist = new Map(); }
}

async function setWish(id, wanted, at = Date.now()) {
  track("wish", id, wishlist.get(id), wanted ? wishlist.get(id) ?? at : undefined);  // für Rückgängig (history.js)
  if (wanted) wishlist.set(id, wishlist.get(id) || at); else wishlist.delete(id);
  saveWishLocal();
  if (!wishDb) return;
  const ref = wishDb.collection(DB_WISH).doc(encodeURIComponent(id));
  await (wanted ? ref.set({ id, t: wishlist.get(id) }) : ref.delete());
}

async function replaceWishlist(raw) {
  const next = cleanWish(raw);
  for (const id of [...wishlist.keys()]) if (!next.has(id)) await setWish(id, false);
  for (const [id, at] of next) { wishlist.delete(id); await setWish(id, true, at); }
}

// Wie connectLive in store.js: auf claude.ai online speichern, sonst nur im Browser.
async function connectWishLive(onChange) {
  const db = await window.claude?.use?.("db");
  if (!db) return;
  wishDb = db;
  db.collection(DB_WISH).onSnapshot(snap => {
    wishlist = cleanWish(snap.docs.map(d => d.data()));
    saveWishLocal();
    onChange();
  }, () => (wishDb = null));
}

// ---------- Ansicht ----------
// set: gewählter Booster ("" = alle), page: wie oft "Nächstes Booster"/"Mehr anzeigen" gedrückt wurde
const wl = { tab: "cards", query: "", sort: "new", set: "", page: 1, hits: null, counts: null };
const PAGE = 60;

const byNum = (a, b) => a.num.localeCompare(b.num, "en", { numeric: true });
const rarer = (a, b) => RARITY[b.cat].rank - RARITY[a.cat].rank;
// Erscheinungsdatum folgt der Set-Reihenfolge in data/cards.js (setIdx).
const SORTS = {
  new: (a, b) => b.setIdx - a.setIdx || rarer(a, b) || byNum(a, b),
  old: (a, b) => a.setIdx - b.setIdx || rarer(a, b) || byNum(a, b),
  dex: (a, b) => a.ns[0] - b.ns[0] || b.setIdx - a.setIdx || byNum(a, b),
  rarity: (a, b) => rarer(a, b) || b.setIdx - a.setIdx || byNum(a, b),
};
const SORT_LABELS = { new: "sortNew", old: "sortOld", dex: "sortDex", rarity: "sortRarity" };

const inBinderCard = c => c.ns.some(n => owned(n)?.card === c.id);
const cardMeta = c => `${esc(c.set)} · ${esc(c.num)}/${esc(c.total)} · ${esc(c.date.slice(0, 4))}`;

function cardTile(c) {
  const on = isWished(c.id);
  return `<div class="wl-card${on ? " wished" : ""}" data-card="${esc(c.id)}">
    <button class="star" data-star title="${t(on ? "wishRemove" : "wishAdd")}" aria-pressed="${on}">★</button>
    ${cardImage(c, `<span>${esc(c.name)}</span>`)}
    <b>${esc(c.name)}</b>
    <span class="sub">${cardMeta(c)}</span>
    ${inBinderCard(c) ? `<span class="inb">${t("inBinderTag")}</span>` : ""}
  </div>`;
}

// Alle Sets mit Karten, neuestes zuerst (für die Booster-Auswahl).
let setOrder = null;
const allSets = () => (setOrder ??= [...new Set([...allCards().values()].map(c => c.setIdx))].sort((a, b) => b - a));
const grouped = () => wl.sort === "new" || wl.sort === "old";  // nach Erscheinen sortiert: mit Trennern je Booster
const searching = () => !!wl.query.trim();

// Sichtbare Karten: nach Booster sortiert immer ganze Booster (ohne Suche einer pro Klick,
// mit Suche so viele, bis 60 Karten je Klick erreicht sind), sonst 60 Karten je Klick.
function visibleCards() {
  const hits = wl.hits;
  if (!grouped()) return hits.slice(0, PAGE * wl.page);
  if (wl.set !== "") return hits;
  let end = 0, sets = 0;
  while (end < hits.length && (searching() ? end < PAGE * wl.page : sets < wl.page)) {
    const s = hits[end].setIdx;
    while (end < hits.length && hits[end].setIdx === s) end++;
    sets++;
  }
  return hits.slice(0, end);
}

// Nächster Booster in Sortierrichtung, wenn ein einzelner gewählt ist.
function nextSet() {
  const order = wl.sort === "old" ? [...allSets()].reverse() : allSets();
  return order[order.indexOf(+wl.set) + 1];
}

const boosterSep = i => `<div class="wl-sep">
    <div class="wl-logo">${imgChain(logoSources(i), 'alt=""')}</div>
    <div><b>${esc(setName(i))}</b><div class="sub">${TCG_SETS[i][3].slice(0, 4)} · ${t("wlHits", { n: wl.counts[i] })}</div></div>
  </div>`;

function renderCardList() {
  if (!wl.hits) {
    wl.hits = searchCards(wl.query).filter(c => wl.set === "" || c.setIdx === +wl.set).sort(SORTS[wl.sort]);
    wl.counts = countBy(wl.hits, c => c.setIdx);
  }
  const shown = visibleCards();
  $("#wlCount").textContent = t("wlHits", { n: wl.hits.length.toLocaleString(LANG) });
  $("#wlGrid").innerHTML = shown.map((c, i) =>
    (grouped() && (!i || shown[i - 1].setIdx !== c.setIdx) ? boosterSep(c.setIdx) : "") + cardTile(c)).join("")
    || `<p class="sub">${t("nothingFound")}</p>`;
  const single = grouped() && wl.set !== "";
  $("#wlMore").hidden = single ? nextSet() === undefined : shown.length >= wl.hits.length;
  $("#wlMore").textContent = grouped() && !searching() ? t("nextBooster") : t("more");
}

function showMore() {
  if (grouped() && wl.set !== "") {  // einzelner Booster: zum nächsten wechseln
    Object.assign(wl, { set: String(nextSet()), page: 1, hits: null });
    $("#wlSet").value = wl.set;
    renderCardList();
    $("#wlCards").scrollIntoView({ behavior: "smooth" });
  } else {
    wl.page++;
    renderCardList();
  }
}

// Gewünschte Karten als Karten, am längsten gewünschte zuerst.
function wishListHtml() {
  const cards = [...wishlist].sort((a, b) => a[1] - b[1]).map(([id, at]) => ({ c: cardById(id), at })).filter(x => x.c);
  if (!cards.length) return `<p class="sub">${t("wishEmpty")}</p>`;
  return `<div class="wl-grid">${cards.map(({ c, at }) => `<div class="wl-card wished" data-card="${esc(c.id)}">
    ${cardImage(c, `<span>${esc(c.name)}</span>`)}
    <b>${esc(c.name)}</b>
    <span class="sub">${cardMeta(c)}</span>
    ${at ? `<span class="sub">${t("wishedSince", { d: new Date(at).toLocaleDateString(LANG) })}</span>` : ""}
    <button class="ghost unwish" data-unwish="${esc(c.id)}">${t("unwish")}</button>
  </div>`).join("")}</div>`;
}

// Booster-Vorschläge: Sets nach Anzahl Wunschkarten. Sets ohne Booster (NON_BOOSTER) extra.
function shopHtml() {
  const cards = [...wishlist.keys()].map(cardById).filter(Boolean);
  if (!cards.length) return `<p class="sub">${t("shopEmpty")}</p>`;
  const bySet = new Map();
  for (const c of cards) bySet.set(c.setIdx, [...(bySet.get(c.setIdx) || []), c]);
  const sets = [...bySet].sort((a, b) => b[1].length - a[1].length || b[0] - a[0]);
  const block = ([i, list]) => `<div class="shop-set">
    <div class="shop-main">
      <div class="shop-head"><b>${esc(setName(i))}</b> <span class="sub">${TCG_SETS[i][3].slice(0, 4)}</span></div>
      <div class="shop-cards">${list.map(c =>
        `<div class="wl-thumb" data-card="${esc(c.id)}" title="${esc(c.name)} · ${esc(c.num)}">${cardImage(c)}</div>`).join("")}</div>
    </div>
    <div class="shop-side">
      <span class="shop-n">${list.length === 1 ? t("shopOne") : t("shopCount", { n: list.length })}</span>
      <div class="wl-logo shop-logo">${imgChain(logoSources(i), `alt="${esc(setName(i))}"`)}</div>
    </div>
  </div>`;
  const boosters = sets.filter(([i]) => !NON_BOOSTER.test(TCG_SETS[i][1]));
  const singles = sets.filter(([i]) => NON_BOOSTER.test(TCG_SETS[i][1]));
  return `<p class="sub">${t("shopHint")}</p>${boosters.map(block).join("")}
    ${singles.length ? `<h4 class="wl-set">${t("shopSingles")}</h4>${singles.map(block).join("")}` : ""}`;
}

function renderWishView() {
  $("#wlNum").textContent = wishlist.size;
  document.querySelectorAll(".wtab").forEach(b => b.classList.toggle("on", b.dataset.wtab === wl.tab));
  $("#wlCards").hidden = wl.tab !== "cards";
  $("#wlSide").hidden = wl.tab === "cards";
  if (wl.tab === "cards") renderCardList();
  else $("#wlSide").innerHTML = wl.tab === "list" ? wishListHtml() : shopHtml();
}

function toggleWish(id) {
  setWish(id, !isWished(id)).catch(() => setStatus("err", t("saveFailed")));
  const tile = $(`#wlGrid .wl-card[data-card="${CSS.escape(id)}"]`);
  if (wl.tab === "cards" && tile) { tile.outerHTML = cardTile(cardById(id)); $("#wlNum").textContent = wishlist.size; }
  else renderWishView();
}

function bindWishEvents() {
  $("#wlSort").innerHTML = Object.entries(SORT_LABELS).map(([k, label]) => `<option value="${k}">${t(label)}</option>`).join("");
  $("#wlSet").innerHTML = `<option value="">${t("allBoosters")}</option>` +
    allSets().map(i => `<option value="${i}">${esc(setName(i))} (${TCG_SETS[i][3].slice(0, 4)})</option>`).join("");
  const refresh = changes => { Object.assign(wl, { page: 1, hits: null }, changes); renderCardList(); };
  let timer;
  on("#wlSearch", "input", e => { clearTimeout(timer); timer = setTimeout(() => refresh({ query: e.target.value }), 150); });
  on("#wlSet", "change", e => refresh({ set: e.target.value }));
  on("#wlSort", "change", e => refresh({ sort: e.target.value }));
  on("#wlMore", "click", showMore);
  onClosest("#wlGrid", "click", "[data-star]", b => toggleWish(b.closest(".wl-card").dataset.card));
  onClosest("#wlSide", "click", "[data-unwish]", b => toggleWish(b.dataset.unwish));
  // Klick aufs Kartenbild: Vollansicht
  onClosest("#wishView", "click", "[data-card] .cardbox", box => openZoom(cardById(box.closest("[data-card]").dataset.card)));
  document.querySelectorAll(".wtab").forEach(b => (b.onclick = () => { wl.tab = b.dataset.wtab; renderWishView(); scrollTo({ top: 0 }); }));
}
