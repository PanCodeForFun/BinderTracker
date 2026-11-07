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
const wl = { tab: "cards", query: "", sort: "new", limit: 60, hits: null };

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

function renderCardList() {
  wl.hits ??= searchCards(wl.query).sort(SORTS[wl.sort]);
  $("#wlCount").textContent = t("wlHits", { n: wl.hits.length.toLocaleString(LANG) });
  $("#wlGrid").innerHTML = wl.hits.slice(0, wl.limit).map(cardTile).join("") || `<p class="sub">${t("nothingFound")}</p>`;
  $("#wlMore").hidden = wl.hits.length <= wl.limit;
}

// Gewünschte Karten als Karten, am längsten gewünschte zuerst.
function wishListHtml() {
  const cards = [...wishlist].sort((a, b) => a[1] - b[1]).map(([id, at]) => ({ c: cardById(id), at })).filter(x => x.c);
  if (!cards.length) return `<p class="sub">${t("wishEmpty")}</p>`;
  return `<div class="wl-grid">${cards.map(({ c, at }) => `<div class="wl-card wished">
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
    <div class="shop-head"><b>${esc(setName(i))}</b> <span class="sub">${TCG_SETS[i][3].slice(0, 4)}</span>
      <span class="shop-n">${list.length === 1 ? t("shopOne") : t("shopCount", { n: list.length })}</span></div>
    <div class="shop-cards">${list.map(c => `<div class="wl-thumb" title="${esc(c.name)} · ${esc(c.num)}">${cardImage(c)}</div>`).join("")}</div>
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
  let timer;
  on("#wlSearch", "input", e => {
    clearTimeout(timer);
    timer = setTimeout(() => { Object.assign(wl, { query: e.target.value, limit: 60, hits: null }); renderCardList(); }, 150);
  });
  on("#wlSort", "change", e => { Object.assign(wl, { sort: e.target.value, limit: 60, hits: null }); renderCardList(); });
  on("#wlMore", "click", () => { wl.limit += 60; renderCardList(); });
  onClosest("#wlGrid", "click", "[data-star]", b => toggleWish(b.closest(".wl-card").dataset.card));
  onClosest("#wlSide", "click", "[data-unwish]", b => toggleWish(b.dataset.unwish));
  document.querySelectorAll(".wtab").forEach(b => (b.onclick = () => { wl.tab = b.dataset.wtab; renderWishView(); scrollTo({ top: 0 }); }));
}
