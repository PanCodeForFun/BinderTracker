// Wunschliste: Kartenliste zum Durchsuchen, Wunschkarten nach Set und Einkaufshilfe.
// Gespeichert als Liste von Karten-ids im Browser, auf claude.ai zusätzlich online.

const WISH_KEY = STORAGE_KEY + ".wunsch";
const DB_WISH = "wunsch";
let wishlist = new Set();
let wishDb = null;

const cleanWish = ids => new Set((Array.isArray(ids) ? ids : []).filter(id => typeof id === "string" && id));
const isWished = id => wishlist.has(id);

function saveWishLocal() {
  try { localStorage.setItem(WISH_KEY, JSON.stringify([...wishlist])); } catch { /* privater Modus o. ä. */ }
}
function loadWishLocal() {
  try { wishlist = cleanWish(JSON.parse(localStorage.getItem(WISH_KEY))); } catch { wishlist = new Set(); }
}

async function setWish(id, wanted) {
  if (wanted) wishlist.add(id); else wishlist.delete(id);
  saveWishLocal();
  if (!wishDb) return;
  const ref = wishDb.collection(DB_WISH).doc(encodeURIComponent(id));
  await (wanted ? ref.set({ id }) : ref.delete());
}

async function replaceWishlist(ids) {
  const next = cleanWish(ids);
  for (const id of new Set([...wishlist, ...next])) await setWish(id, next.has(id));
}

// Wie connectLive in store.js: auf claude.ai online speichern, sonst nur im Browser.
async function connectWishLive(onChange) {
  const db = await window.claude?.use?.("db");
  if (!db) return;
  wishDb = db;
  db.collection(DB_WISH).onSnapshot(snap => {
    wishlist = cleanWish(snap.docs.map(d => d.data().id));
    saveWishLocal();
    onChange();
  }, () => (wishDb = null));
}

// ---------- Ansicht ----------
const wl = { query: "", limit: 60, tab: "list", allSets: false, hits: null };

const inBinderCard = c => c.ns.some(n => owned(n)?.card === c.id);

function wishTile(c) {
  const on = isWished(c.id);
  return `<div class="wl-card${on ? " wished" : ""}" data-card="${esc(c.id)}">
    <button class="star" data-star title="${t(on ? "wishRemove" : "wishAdd")}" aria-pressed="${on}">★</button>
    ${cardImage(c, `<span>${esc(c.name)}</span>`)}
    <b>${esc(c.name)}</b>
    <span class="sub">${esc(c.set)} · ${esc(c.num)}/${esc(c.total)}</span>
    ${inBinderCard(c) ? `<span class="inb">${t("inBinderTag")}</span>` : ""}
  </div>`;
}

function renderCardList() {
  wl.hits ??= searchCards(wl.query);
  $("#wlCount").textContent = t("wlHits", { n: wl.hits.length.toLocaleString(LANG) });
  $("#wlGrid").innerHTML = wl.hits.slice(0, wl.limit).map(wishTile).join("") || `<p class="sub">${t("nothingFound")}</p>`;
  $("#wlMore").hidden = wl.hits.length <= wl.limit;
}

// Wunschkarten nach Set gruppiert, neuestes Set zuerst.
function wishListHtml() {
  const cards = [...wishlist].map(cardById).filter(Boolean).sort((a, b) => b.setIdx - a.setIdx || a.ns[0] - b.ns[0]);
  if (!cards.length) return `<p class="sub">${t("wishEmpty")}</p>`;
  const counts = countBy(cards, c => c.setIdx);
  return cards.map((c, i) => `${i && cards[i - 1].setIdx === c.setIdx ? "" :
      `<h4 class="wl-set">${esc(c.set)} <small>${counts[c.setIdx]}</small></h4>`}
    <div class="wl-item">
      <div class="wl-thumb">${cardImage(c)}</div>
      <div><b>${esc(c.name)}</b><div class="sub">${esc(c.num)}/${esc(c.total)} · ${c.ns.map(pad).join(", ")}</div></div>
      <button class="x" data-unwish="${esc(c.id)}" title="${t("wishRemove")}">×</button>
    </div>`).join("");
}

// Je Set: Lücken (leere Slots, für die das Set eine Karte hat), Upgrades (eigene Pokémon,
// für die das Set eine seltenere Stufe hat) und Wunschkarten.
function shopRows() {
  const rows = new Map();
  const row = i => rows.get(i) || rows.set(i, { i, gaps: 0, up: 0, wish: 0 }).get(i);
  for (const p of DEX) {
    const e = owned(p.n), have = e ? RARITY[e.r].tierRank : -1, counted = new Set();
    for (const c of cardsFor(p.n)) {
      if (counted.has(c.setIdx) || RARITY[c.cat].tierRank <= have) continue;
      counted.add(c.setIdx);
      row(c.setIdx)[e ? "up" : "gaps"]++;
    }
  }
  for (const id of wishlist) { const c = cardById(id); if (c) row(c.setIdx).wish++; }
  return [...rows.values()]
    .filter(r => wl.allSets || !NON_BOOSTER.test(TCG_SETS[r.i][1]))
    .sort((a, b) => b.gaps - a.gaps || b.up - a.up || b.wish - a.wish);
}

function shopHtml() {
  const rows = shopRows();
  return `<p class="sub">${t("shopHint")}</p>
    <label class="wl-check"><input type="checkbox" id="wlAll"${wl.allSets ? " checked" : ""}> ${t("shopAll")}</label>
    <div class="shop-wrap"><table class="shop"><thead><tr><th>${t("set")}</th><th>${t("shopGaps")}</th><th>${t("shopUp")}</th><th>${t("shopWish")}</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(setName(r.i))} <small>${TCG_SETS[r.i][3].slice(0, 4)}</small></td>
      <td>${r.gaps}</td><td>${r.up}</td><td>${r.wish}</td></tr>`).join("")}</tbody></table></div>`;
}

function renderWishSide() {
  $("#wlNum").textContent = wishlist.size;
  document.querySelectorAll(".wtab").forEach(b => b.classList.toggle("on", b.dataset.wtab === wl.tab));
  $("#wlSide").innerHTML = wl.tab === "list" ? wishListHtml() : shopHtml();
}

function renderWishView() {
  renderCardList();
  renderWishSide();
}

function toggleWish(id) {
  setWish(id, !isWished(id)).catch(() => setStatus("err", t("saveFailed")));
  const tile = $(`#wlGrid .wl-card[data-card="${CSS.escape(id)}"]`);
  if (tile) tile.outerHTML = wishTile(cardById(id));
  renderWishSide();
}

function bindWishEvents() {
  let timer;
  on("#wlSearch", "input", e => {
    clearTimeout(timer);
    timer = setTimeout(() => { Object.assign(wl, { query: e.target.value, limit: 60, hits: null }); renderCardList(); }, 150);
  });
  on("#wlMore", "click", () => { wl.limit += 60; renderCardList(); });
  onClosest("#wlGrid", "click", "[data-star]", b => toggleWish(b.closest(".wl-card").dataset.card));
  onClosest("#wlSide", "click", "[data-unwish]", b => toggleWish(b.dataset.unwish));
  on("#wlSide", "change", e => { if (e.target.id === "wlAll") { wl.allSets = e.target.checked; renderWishSide(); } });
  document.querySelectorAll(".wtab").forEach(b => (b.onclick = () => { wl.tab = b.dataset.wtab; renderWishSide(); }));
}
