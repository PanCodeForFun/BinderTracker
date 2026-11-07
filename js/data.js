// Pokédex, Kartendaten, Binder-Positionen und Suche.

// name = Anzeigename in der gewählten Sprache, alt = der andere Name
const DEX = POKEDEX.map(([n, de, en]) => ({ n, de, en, name: LANG === "en" ? en : de, alt: LANG === "en" ? de : en }));
const BY_N = new Map(DEX.map(p => [p.n, p]));
const MAX_N = DEX[DEX.length - 1].n;

const pad = n => "#" + String(n).padStart(4, "0");
const spriteUrl = n => SPRITES[n] || "";

// ---------- Karten ----------
const IMG_HOST = "https://images.pokemontcg.io/";
const safeName = s => s.replace(/[^A-Za-z0-9_-]/g, "_");
const cardCache = new Map();

// Bildquellen der Reihe nach: lokales Bild der gewählten Sprache, dann das der anderen,
// zuletzt online. Lokal: images/ (tools/download_images.py), sources/images-de/ (tools/download_german.py).
function imageSources(setId, num, img, deSet, deNum) {
  const de = window.LOCAL_IMAGES_DE && deSet && deNum ? `sources/images-de/${deSet}/${safeName(deNum)}.webp` : "";
  const en = window.LOCAL_IMAGES ? `images/${setId}/${safeName(num)}.png` : "";
  const online = img?.startsWith("http") ? img : IMG_HOST + (img || `${setId}/${num}.png`);
  return (LANG === "en" ? [en, de, online] : [de, en, online]).filter(Boolean);
}

// Alle Karten eines Pokémon, nach Stufe und dann Erscheinungsdatum.
function cardsFor(n) {
  if (!cardCache.has(n)) {
    const de = LANG !== "en";
    const cards = (TCG_CARDS[n] || []).map(([setIdx, num, cat, nameEn, rarityIdx, img, nameDe, deNum]) => {
      const [setId, setEn, , date, total, setDe, deSet] = TCG_SETS[setIdx];
      return {
        id: `${setId}-${num}`, date, total, num, cat, setIdx, rarity: TCG_RARITY_NAMES[rarityIdx],
        name: (de && nameDe) || nameEn, set: (de && setDe) || setEn, srcs: imageSources(setId, num, img, deSet, deNum),
      };
    });
    cards.sort((a, b) => RARITY[a.cat].tierRank - RARITY[b.cat].tierRank || a.setIdx - b.setIdx || a.num.localeCompare(b.num, "en", { numeric: true }));
    cardCache.set(n, cards);
  }
  return cardCache.get(n);
}
const findCard = (n, id) => (id ? cardsFor(n).find(c => c.id === id) : undefined);

// ---------- Binder ----------
function locate(n) {
  const binder = n <= LAYOUT.binder1Size ? 1 : 2;
  const i = n - 1 - (binder === 2 ? LAYOUT.binder1Size : 0);
  const slot = i % LAYOUT.slotsPerPage;
  return { binder, page: Math.floor(i / LAYOUT.slotsPerPage) + 1, row: Math.floor(slot / LAYOUT.cols) + 1, col: (slot % LAYOUT.cols) + 1 };
}
const firstOnPage = (binder, page) => (binder === 2 ? LAYOUT.binder1Size : 0) + (page - 1) * LAYOUT.slotsPerPage + 1;
const inBinder = (binder, n) => (binder === 1) === (n <= LAYOUT.binder1Size);
const pageCount = binder =>
  Math.max(1, Math.ceil((binder === 1 ? Math.min(MAX_N, LAYOUT.binder1Size) : MAX_N - LAYOUT.binder1Size) / LAYOUT.slotsPerPage));

const slotText = ({ row, col }) => `${t("rows")[row - 1]} ${t("cols")[col - 1]}`;

// ---------- Suche ----------
const norm = s => s.toLowerCase().replace(/♀/g, "w").replace(/♂/g, "m")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
const SEARCH_INDEX = DEX.map(p => ({ p, keys: [norm(p.de), norm(p.en)] }));

// Treffer nach Güte: exakt, Anfang, irgendwo. Zahlen suchen die Dex-Nummer.
function search(query, limit = 12) {
  const q = query.trim().replace(/^#/, "");
  if (/^\d+$/.test(q)) return BY_N.has(+q) ? [BY_N.get(+q)] : [];
  const k = norm(q);
  if (!k) return [];
  const score = keys => keys.includes(k) ? 0 : keys.some(x => x.startsWith(k)) ? 1 : keys.some(x => x.includes(k)) ? 2 : -1;
  return SEARCH_INDEX
    .map(x => [score(x.keys), x.p])
    .filter(([s]) => s >= 0)
    .sort((a, b) => a[0] - b[0] || a[1].n - b[1].n)
    .slice(0, limit)
    .map(([, p]) => p);
}
