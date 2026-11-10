// Bereich Sammlung mit drei Reitern: Statistik, Wert (Preise aus js/prices.js) und Upgrades.

const coll = { tab: "stats", upSort: "dex" };
const COLLECTION_TABS = { stats: renderStats, value: renderValue, upgrades: renderUpgrades };

function renderCollection() {
  markOn(".ctab", "ctab", coll.tab);
  $("#upNum").textContent = upgradeRows().length || "";
  (COLLECTION_TABS[coll.tab] || COLLECTION_TABS.stats)();
}
const setCollectionBody = html => ($("#statsBody").innerHTML = html);

// ---------- Statistik ----------
function renderStats() {
  const entries = activeEntries();
  const counts = countBy(entries, e => RARITY[e.r].tier);
  const max = Math.max(1, ...Object.values(counts));
  const binderTile = b => progressTile(`Binder ${b}`, ownedCount(p => inBinder(b, p.n)), slotsInBinder(b).length);
  setCollectionBody(`
    <div class="stat-tiles">${progressTile(t("total"), ownedCount(p => !p.form), DEX.length)}${binderTile(1)}${binderTile(2)}${
      FORM_LIST.length ? progressTile(t("forms"), ownedCount(p => p.form), FORM_LIST.length) : ""}</div>
    <h3>${t("byRarity")}</h3>
    <div class="bars">${TIERS.map(tier => `
      <div class="barrow"><span class="bl"><i style="background:${tier.color}"></i>${esc(tier.label)}</span>
      <span class="bt"><span style="width:${((counts[tier.id] || 0) / max) * 100}%;background:${tier.color}"></span></span>
      <b>${counts[tier.id] || 0}</b></div>`).join("")}</div>
    <p class="sub">${t("withDesign", { a: entries.filter(e => e.card).length, b: entries.length })}</p>`);
}

// ---------- Wert ----------
const valueRun = { busy: false, done: 0, total: 0, failed: 0 };

// Preise aller Karten holen (Knopf „Binderwert ermitteln“).
async function loadCollectionValue() {
  if (valueRun.busy) return;
  const items = ownedCards();
  Object.assign(valueRun, { busy: true, done: 0, total: items.length, failed: 0 });
  renderValue();
  const showing = () => view.mode === "stats";
  await loadPrices(items.map(x => x.c), failed => {
    if (failed) valueRun.failed++;
    valueRun.done++;
    if (showing() && valueRun.done % 10 === 0) renderValue();
  });
  valueRun.busy = false;
  if (valueRun.failed) toast(t("pricesFailed", { n: valueRun.failed }));
  if (showing()) renderValue();
}

// Zeigt nur gespeicherte Preise. Neu abgefragt wird erst über den Knopf.
function renderValue() {
  const items = ownedCards().map(x => ({ ...x, v: cardValue(x.c, x.e.r === "reverse"), at: priceAge(x.c) }));
  const priced = items.filter(x => x.v != null);
  const sum = list => list.reduce((s, x) => s + x.v, 0);
  const tile = (label, list) => statTile(list.length ? euro(sum(list)) : "–", label);
  const oldest = Math.min(...items.map(x => x.at).filter(Boolean));
  const noDesign = activeEntries().length - items.length;
  const top = [...priced].sort((a, b) => b.v - a.v).slice(0, 10);
  const btn = valueRun.busy
    ? `<button class="ghost primary" disabled>${t("valueLoading", { a: valueRun.done, b: valueRun.total })}</button>
       ${progressBar(valueRun.done, valueRun.total)}`
    : `<button id="btnValue" class="ghost primary"${items.length ? "" : " disabled"}>${t("valueButton")}</button>`;

  setCollectionBody(`
    <div class="value-head"><p class="sub">${t("valueHint")}</p><div class="value-btn">${btn}</div></div>
    <div class="stat-tiles">${tile(t("total"), priced)}${[1, 2].map(b => tile(`Binder ${b}`, priced.filter(x => inBinder(b, x.n)))).join("")}</div>
    <p class="sub">${t("valueCount", { a: priced.length, b: items.length })}${isFinite(oldest) ? " " + t("valueAsOf", { d: new Date(oldest).toLocaleDateString(LANG) }) : ""}${
      noDesign ? " " + t("valueNoDesign", { n: noDesign }) : ""}</p>
    ${top.length ? `<h3>${t("valueTop")}</h3><ol class="top-cards">${top.map(x => `
      <li data-n="${x.n}"><div class="wl-thumb">${cardImage(x.c)}</div>
        <div><b>${esc(x.c.name)}</b><div class="sub">${esc(x.c.set)} · ${esc(x.c.num)}/${esc(x.c.total)} · ${esc(RARITY[x.e.r].label)}</div></div>
        <b class="eur">${euro(x.v)}</b></li>`).join("")}</ol>` : ""}`);
}

// ---------- Upgrades ----------
// Pokémon mit Haken „Will ich ersetzen“ oder mit Wunschkarten. Automatische Upgrades
// (unter UPGRADE_BELOW) stehen nicht hier, nur am Slot. Klick springt zum Slot.
function upgradeRows() {
  const wished = new Map();
  for (const id of wishlist.keys()) for (const n of cardById(id)?.ns || []) wished.set(n, [...(wished.get(n) || []), cardById(id)]);
  const rows = SLOTS.filter(p => owned(p.n)?.up || wished.has(p.n)).map(p => ({ p, e: owned(p.n), wishes: wished.get(p.n) || [] }));
  const rank = row => (row.e ? RARITY[row.e.r].rank : -1);
  if (coll.upSort === "common") rows.sort((a, b) => rank(a) - rank(b) || slotIndex(a.p.n) - slotIndex(b.p.n));
  return rows;
}

function upgradeRowHtml({ p, e, wishes }) {
  const r = e && RARITY[e.r], card = e && findCard(p.n, e.card);
  const now = e ? `<span class="up-rar">${esc(r.label)}</span>${card ? ` · ${esc(card.set)} · ${esc(card.num)}` : ""}${e.up ? ` · ${t("upManual")}` : ""}` : t("missingYet");
  const chips = wishes.map(c => `<span class="up-chip" title="${esc(c.name)}"><span class="wl-thumb">${cardImage(c)}</span>${esc(c.set)} · ${esc(c.num)}</span>`).join("");
  return `<li data-n="${p.n}" ${colorStyle(r)}><div class="wl-thumb">${card ? cardImage(card, "", cardLang(e)) : spriteImg(p.n)}</div>
        <div><b>${pad(p.n)} ${esc(p.name)}</b><div class="sub">${now}</div>${wishes.length ? `<div class="up-wish">
          <span class="sub">★ ${t("wish")}:</span>${chips}</div>` : ""}</div>
        <span class="sub">${whereText(p.n)}</span></li>`;
}

function renderUpgrades() {
  const rows = upgradeRows();
  const sorts = [["dex", t("sortDex")], ["common", t("upSortCommon")]];
  const count = t("upCount", { n: rows.length, m: rows.filter(x => x.e?.up).length, w: rows.filter(x => x.wishes.length).length });
  setCollectionBody(`<p class="sub">${t("upHint", { x: esc(TIER[UPGRADE_BELOW].label) })}</p>
    <div class="up-tools"><b>${count}</b>
      <select id="upSort" title="${t("sortLabel")}">${optionsHtml(sorts, coll.upSort)}</select></div>
    ${!rows.length ? `<p class="sub">${t("upEmpty")}</p>` : `<ol class="top-cards up-list">${rows.map(upgradeRowHtml).join("")}</ol>`}`);
}

function bindCollectionEvents() {
  onEach(".ctab", b => { coll.tab = b.dataset.ctab; renderCollection(); });
  onClosest("#statsBody", "click", "#btnValue", loadCollectionValue);
  onClosest("#statsBody", "click", ".top-cards li[data-n]", li => goTo(+li.dataset.n));
  onClosest("#statsBody", "change", "#upSort", s => { coll.upSort = s.value; renderUpgrades(); });
}
