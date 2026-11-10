// Bereich Wunschliste mit drei Reitern: Kartenliste (alle Karten, ★ zum Wünschen), Wunschliste
// (gewünschte Karten, älteste zuerst) und Einkaufshilfe (Booster-Vorschläge aus den Wunschkarten).
// Die Daten (wishlist, setWish) stehen in js/store.js.

// set: gewählter Booster ("" = alle), page: wie oft "Nächstes Booster"/"Mehr anzeigen" gedrückt wurde,
// hits/counts: Treffer der aktuellen Suche (null = neu berechnen)
const wl = { tab: "cards", query: "", sort: "new", set: "", page: 1, hits: null, counts: null };
const PAGE = 60;

const rarer = (a, b) => RARITY[b.cat].rank - RARITY[a.cat].rank;
// Erscheinungsdatum folgt der Set-Reihenfolge in data/cards.js (setIdx).
const SORTS = {
  new: { label: "sortNew", cmp: (a, b) => b.setIdx - a.setIdx || rarer(a, b) || byCardNumber(a, b) },
  old: { label: "sortOld", cmp: (a, b) => a.setIdx - b.setIdx || rarer(a, b) || byCardNumber(a, b) },
  dex: { label: "sortDex", cmp: (a, b) => slotIndex(a.ns[0]) - slotIndex(b.ns[0]) || b.setIdx - a.setIdx || byCardNumber(a, b) },
  rarity: { label: "sortRarity", cmp: (a, b) => rarer(a, b) || b.setIdx - a.setIdx || byCardNumber(a, b) },
};

const inBinderCard = c => c.ns.some(n => owned(n)?.card === c.id);

// Karte als Kachel. top: über dem Bild (★), bottom: unter Set und Nummer.
function wishCard(c, { wished, top = "", bottom = "" }) {
  return `<div class="wl-card${wished ? " wished" : ""}" data-card="${esc(c.id)}">
    ${top}${cardImage(c, `<span>${esc(c.name)}</span>`)}
    <b>${esc(c.name)}</b>
    <span class="sub">${esc(c.set)} · ${esc(c.num)}/${esc(c.total)} · ${esc(c.year)}</span>
    ${bottom}
  </div>`;
}

// Kachel in der Kartenliste: mit ★ und „im Binder“.
function cardTile(c) {
  const wished = isWished(c.id);
  return wishCard(c, {
    wished,
    top: `<button class="star" data-star title="${t(wished ? "wishRemove" : "wishAdd")}" aria-pressed="${wished}">★</button>\n    `,
    bottom: inBinderCard(c) ? `<span class="inb">${t("inBinderTag")}</span>` : "",
  });
}

// ---------- Kartenliste ----------
// Alle Sets mit Karten, neuestes zuerst (für die Booster-Auswahl).
let setOrder = null;
const allSets = () => (setOrder ??= [...new Set([...allCards().values()].map(c => c.setIdx))].sort((a, b) => b - a));
const grouped = () => wl.sort === "new" || wl.sort === "old";  // nach Erscheinen sortiert: mit Trennern je Booster
const searching = () => !!wl.query.trim();
const singleSet = () => grouped() && wl.set !== "";

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
    <div><b>${esc(setName(i))}</b><div class="sub">${SETS[i].year} · ${t("wlHits", { n: wl.counts[i] })}</div></div>
  </div>`;

function renderCardList() {
  if (!wl.hits) {
    wl.hits = searchCards(wl.query).filter(c => wl.set === "" || c.setIdx === +wl.set).sort(SORTS[wl.sort].cmp);
    wl.counts = countBy(wl.hits, c => c.setIdx);
  }
  const shown = visibleCards();
  $("#wlCount").textContent = t("wlHits", { n: wl.hits.length.toLocaleString(LANG) });
  $("#wlGrid").innerHTML = shown.map((c, i) =>
    (grouped() && (!i || shown[i - 1].setIdx !== c.setIdx) ? boosterSep(c.setIdx) : "") + cardTile(c)).join("")
    || `<p class="sub">${t("nothingFound")}</p>`;
  $("#wlMore").hidden = singleSet() ? nextSet() === undefined : shown.length >= wl.hits.length;
  $("#wlMore").textContent = grouped() && !searching() ? t("nextBooster") : t("more");
}

// Neue Suche, Sortierung oder Booster: Liste von vorn.
function refreshCardList(changes) {
  Object.assign(wl, { page: 1, hits: null }, changes);
  renderCardList();
}

function showMore() {
  if (singleSet()) {  // einzelner Booster: zum nächsten wechseln
    refreshCardList({ set: String(nextSet()) });
    $("#wlSet").value = wl.set;
    $("#wlCards").scrollIntoView({ behavior: "smooth" });
  } else {
    wl.page++;
    renderCardList();
  }
}

// ---------- Wunschliste und Einkaufshilfe ----------
// Gewünschte Karten als Karten, am längsten gewünschte zuerst.
function wishListHtml() {
  const cards = [...wishlist].sort((a, b) => a[1] - b[1]).map(([id, at]) => ({ c: cardById(id), at })).filter(x => x.c);
  if (!cards.length) return `<p class="sub">${t("wishEmpty")}</p>`;
  return `<div class="wl-grid">${cards.map(({ c, at }) => wishCard(c, {
    wished: true,
    bottom: `${at ? `<span class="sub">${t("wishedSince", { d: new Date(at).toLocaleDateString(LANG) })}</span>` : ""}
    <button class="ghost unwish" data-unwish="${esc(c.id)}">${t("unwish")}</button>`,
  })).join("")}</div>`;
}

// Booster-Vorschläge: Sets nach Anzahl Wunschkarten. Sets ohne Booster (NON_BOOSTER) extra.
function shopHtml() {
  const cards = [...wishlist.keys()].map(cardById).filter(Boolean);
  if (!cards.length) return `<p class="sub">${t("shopEmpty")}</p>`;
  const sets = [...groupBy(cards, c => c.setIdx)].sort((a, b) => b[1].length - a[1].length || b[0] - a[0]);
  const block = ([i, list]) => `<div class="shop-set">
    <div class="shop-main">
      <div class="shop-head"><b>${esc(setName(i))}</b> <span class="sub">${SETS[i].year}</span></div>
      <div class="shop-cards">${list.map(c =>
        `<div class="wl-thumb" data-card="${esc(c.id)}" title="${esc(c.name)} · ${esc(c.num)}">${cardImage(c)}</div>`).join("")}</div>
    </div>
    <div class="shop-side">
      <span class="shop-n">${list.length === 1 ? t("shopOne") : t("shopCount", { n: list.length })}</span>
      <div class="wl-logo shop-logo">${imgChain(logoSources(i), `alt="${esc(setName(i))}"`)}</div>
    </div>
  </div>`;
  const boosters = sets.filter(([i]) => isBooster(i));
  const singles = sets.filter(([i]) => !isBooster(i));
  return `<p class="sub">${t("shopHint")}</p>${boosters.map(block).join("")}
    ${singles.length ? `<h4 class="wl-set">${t("shopSingles")}</h4>${singles.map(block).join("")}` : ""}`;
}

function renderWishView() {
  $("#wlNum").textContent = wishlist.size;
  markOn(".wtab", "wtab", wl.tab);
  $("#wlCards").hidden = wl.tab !== "cards";
  $("#wlSide").hidden = wl.tab === "cards";
  if (wl.tab === "cards") renderCardList();
  else $("#wlSide").innerHTML = wl.tab === "list" ? wishListHtml() : shopHtml();
}

// ★ in der Kartenliste oder „Nicht mehr wünschen“. In der Kartenliste wird nur die Kachel neu gezeichnet.
function toggleWish(id) {
  saved(setWish(id, !isWished(id)));
  const tile = $(`#wlGrid .wl-card[data-card="${CSS.escape(id)}"]`);
  if (wl.tab === "cards" && tile) { tile.outerHTML = cardTile(cardById(id)); $("#wlNum").textContent = wishlist.size; }
  else renderWishView();
}

function bindWishEvents() {
  $("#wlSort").innerHTML = optionsHtml(Object.entries(SORTS).map(([k, s]) => [k, t(s.label)]));
  $("#wlSet").innerHTML = optionsHtml([["", t("allBoosters")], ...allSets().map(i => [String(i), `${setName(i)} (${SETS[i].year})`])]);
  let timer;
  on("#wlSearch", "input", e => { clearTimeout(timer); timer = setTimeout(() => refreshCardList({ query: e.target.value }), 150); });
  on("#wlSet", "change", e => refreshCardList({ set: e.target.value }));
  on("#wlSort", "change", e => refreshCardList({ sort: e.target.value }));
  on("#wlMore", "click", showMore);
  onClosest("#wlGrid", "click", "[data-star]", b => toggleWish(b.closest(".wl-card").dataset.card));
  onClosest("#wlSide", "click", "[data-unwish]", b => toggleWish(b.dataset.unwish));
  // Klick aufs Kartenbild: Vollansicht
  onClosest("#wishView", "click", "[data-card] .cardbox", box => openZoom(cardById(box.closest("[data-card]").dataset.card)));
  onEach(".wtab", b => { wl.tab = b.dataset.wtab; renderWishView(); scrollTo({ top: 0 }); });
}
