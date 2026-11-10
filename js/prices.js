// Kartenpreise: Cardmarket-Preise in Euro über TCGdex (kostenlos, ohne Schlüssel, täglich aktualisiert).
// Geholt wird nur bei Bedarf: beim Öffnen einer Karte und auf Knopfdruck für die ganze Sammlung.
// Gespeichert im Browser: { "<TCGdex-id>": { n: Preis normal, h: Preis Holo/Reverse, at: abgerufen (ms) } }
// Anzeige: showPrice (js/ui/common.js) und Sammlung › Wert (js/ui/collection.js).

const PRICE_API = "https://api.tcgdex.net/v2/";
const PRICE_MAX_AGE = 24 * 3600 * 1000;  // TCGdex aktualisiert Cardmarket-Preise einmal am Tag
const PRICE_WORKERS = 6;                 // gleichzeitige Abfragen beim Binderwert

const prices = readJson(PRICE_KEY, {});
const savePrices = () => writeJson(PRICE_KEY, prices);

const euro = v => (v == null ? "–" : new Intl.NumberFormat(LANG, { style: "currency", currency: "EUR" }).format(v));
const hasFreshPrice = card => { const p = prices[card.tcgdex]; return !!p && Date.now() - p.at < PRICE_MAX_AGE; };

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
  if (!hasFreshPrice(card)) {
    prices[card.tcgdex] = await fetchPrice(card.tcgdex);
    savePrices();
  }
  return prices[card.tcgdex];
}

// Preise für viele Karten, mehrere gleichzeitig. onEach(fehlgeschlagen) nach jeder Karte.
const loadPrices = (cards, onEach) =>
  runPool(cards, PRICE_WORKERS, async card => {
    let failed = false;
    try { await priceFor(card); } catch { failed = true; }
    onEach(failed);
  });

// Wert einer Karte (nur gespeicherte Preise): Reverse Holo nimmt den Holo-Preis, sonst den normalen.
const cardValue = (card, reverse = false) => {
  const p = card && prices[card.tcgdex];
  return !p ? undefined : reverse ? p.h ?? p.n : p.n ?? p.h;
};
const priceAge = card => prices[card.tcgdex]?.at;
