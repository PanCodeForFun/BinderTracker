// Kartenwerte: Cardmarket-Preise in Euro über TCGdex (kostenlos, ohne Schlüssel, täglich aktualisiert).
// Geholt wird nur bei Bedarf: beim Öffnen einer Karte und auf Knopfdruck für die ganze Sammlung.
// Gespeichert im Browser: { "<TCGdex-id>": { n: Preis normal, h: Preis Holo/Reverse, at: abgerufen (ms) } }

const PRICE_API = "https://api.tcgdex.net/v2/";
const PRICE_KEY = STORAGE_KEY + ".preise";
const PRICE_MAX_AGE = 24 * 3600 * 1000;  // TCGdex aktualisiert Cardmarket-Preise einmal am Tag
const PRICE_WORKERS = 6;                 // gleichzeitige Abfragen beim Binderwert

let prices = {};
try { prices = JSON.parse(localStorage.getItem(PRICE_KEY)) || {}; } catch { prices = {}; }
const savePrices = () => { try { localStorage.setItem(PRICE_KEY, JSON.stringify(prices)); } catch { /* voll o. ä. */ } };

const euro = v => (v == null ? "–" : new Intl.NumberFormat(LANG, { style: "currency", currency: "EUR" }).format(v));
const fresh = p => p && Date.now() - p.at < PRICE_MAX_AGE;

// Preis einer Karte von TCGdex. Erst deutsch, sonst englisch (Preise sind dieselben).
async function fetchPrice(id) {
  for (const lang of ["de", "en"]) {
    const res = await fetch(`${PRICE_API}${lang}/cards/${encodeURIComponent(id)}`);
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`TCGdex ${res.status}`);
    const cm = (await res.json()).pricing?.cardmarket || {};
    return { n: cm.trend ?? cm.avg30 ?? cm.avg ?? null, h: cm["trend-holo"] ?? cm["avg30-holo"] ?? cm["avg-holo"] ?? null, at: Date.now() };
  }
  return { n: null, h: null, at: Date.now() };
}

// Gespeicherten Preis nehmen, wenn er jünger als ein Tag ist, sonst neu holen.
async function priceFor(card) {
  if (!fresh(prices[card.tcgdex])) {
    prices[card.tcgdex] = await fetchPrice(card.tcgdex);
    savePrices();
  }
  return prices[card.tcgdex];
}

// Wert einer Karte: Reverse Holo nimmt den Holo-Preis, sonst den normalen.
const cardValue = (card, reverse = false) => {
  const p = card && prices[card.tcgdex];
  return !p ? undefined : reverse ? p.h ?? p.n : p.n ?? p.h;
};

// Preis in ein Element schreiben (Kartenauswahl, Vollansicht). Holt ihn bei Bedarf.
async function showPrice(el, card, reverse = false) {
  if (!el || !card) return;
  const text = () => {
    const v = cardValue(card, reverse);
    return v == null ? t("noPrice") : t("approx", { v: euro(v) });
  };
  el.textContent = fresh(prices[card.tcgdex]) ? text() : t("priceLoading");
  try { await priceFor(card); el.textContent = text(); } catch { el.textContent = t("priceFailed"); }
}

// ---------- Sammlung › Wert ----------
const valueRun = { busy: false, done: 0, total: 0, failed: 0 };

// Eingetragene Karten mit gewähltem Design.
function ownedCards() {
  return Object.entries(collection)
    .map(([n, e]) => ({ n: +n, e, c: findCard(+n, e.card) }))
    .filter(x => x.c);
}

async function loadCollectionValue() {
  if (valueRun.busy) return;
  const items = ownedCards();
  Object.assign(valueRun, { busy: true, done: 0, total: items.length, failed: 0 });
  renderValue();
  const queue = [...items];
  const worker = async () => {
    for (let x; (x = queue.shift()); ) {
      try { await priceFor(x.c); } catch { valueRun.failed++; }
      valueRun.done++;
      if (view.mode === "stats" && valueRun.done % 10 === 0) renderValue();
    }
  };
  await Promise.all(Array.from({ length: PRICE_WORKERS }, worker));
  valueRun.busy = false;
  if (valueRun.failed) toast(t("pricesFailed", { n: valueRun.failed }));
  if (view.mode === "stats") renderValue();
}

// Zeigt nur gespeicherte Preise. Neu abgefragt wird erst über den Knopf.
function renderValue() {
  const items = ownedCards().map(x => ({ ...x, v: cardValue(x.c, x.e.r === "reverse"), at: prices[x.c.tcgdex]?.at }));
  const priced = items.filter(x => x.v != null);
  const sum = list => list.reduce((s, x) => s + x.v, 0);
  const tile = (label, list) => `<div class="stat"><div class="big">${list.length ? euro(sum(list)) : "–"}</div><div class="lbl">${label}</div></div>`;
  const oldest = Math.min(...items.map(x => x.at).filter(Boolean));
  const noDesign = Object.keys(collection).length - items.length;
  const top = [...priced].sort((a, b) => b.v - a.v).slice(0, 10);
  const btn = valueRun.busy
    ? `<button class="ghost primary" disabled>${t("valueLoading", { a: valueRun.done, b: valueRun.total })}</button>
       <div class="progress"><span style="width:${pct(valueRun.done, valueRun.total)}%"></span></div>`
    : `<button id="btnValue" class="ghost primary"${items.length ? "" : " disabled"}>${t("valueButton")}</button>`;

  $("#statsBody").innerHTML = `
    <div class="value-head"><p class="sub">${t("valueHint")}</p><div class="value-btn">${btn}</div></div>
    <div class="stat-tiles">${tile(t("total"), priced)}${[1, 2].map(b => tile(`Binder ${b}`, priced.filter(x => inBinder(b, x.n)))).join("")}</div>
    <p class="sub">${t("valueCount", { a: priced.length, b: items.length })}${isFinite(oldest) ? " " + t("valueAsOf", { d: new Date(oldest).toLocaleDateString(LANG) }) : ""}${
      noDesign ? " " + t("valueNoDesign", { n: noDesign }) : ""}</p>
    ${top.length ? `<h3>${t("valueTop")}</h3><ol class="top-cards">${top.map(x => `
      <li data-n="${x.n}"><div class="wl-thumb">${cardImage(x.c)}</div>
        <div><b>${esc(x.c.name)}</b><div class="sub">${esc(x.c.set)} · ${esc(x.c.num)}/${esc(x.c.total)} · ${esc(RARITY[x.e.r].label)}</div></div>
        <b class="eur">${euro(x.v)}</b></li>`).join("")}</ol>` : ""}`;
}
