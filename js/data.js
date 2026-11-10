// Pokédex, Sets, Karten, Binder-Positionen und Suche. Die Rohdaten stehen in data/*.js
// (erzeugt von tools/build_data.py), hier werden sie in handliche Objekte übersetzt.

// ---------- Pokédex ----------
// name = Anzeigename in der gewählten Sprache, alt = der andere Name
const DEX = POKEDEX.map(([n, de, en, gen, types = [], kind = ""]) => ({ n, de, en, gen, types, kind, name: localName(de, en), alt: LANG === "en" ? de : en }));
const DEX_BY_N = new Map(DEX.map(p => [p.n, p]));
const MAX_N = DEX[DEX.length - 1].n;

// ---------- Formen (Regionalformen, Megas) ----------
// Eigene Slots mit eigener Nummer (data/forms.js, z. B. 10026 = Alola-Raichu), nur mit Formen-Anhang.
// Ohne Anhang liegen ihre Karten wie gewohnt beim normalen Pokémon. base = Dex-Nummer der Grundform.
const FORM_MODE = readJson(FORMS_KEY, true) !== false;
const ALL_FORMS = (window.FORMS || []).filter(([, base, region]) => DEX_BY_N.has(base) && FORM_REGION[region]).map(([n, base, region, types]) => {
  const b = DEX_BY_N.get(base), r = FORM_REGION[region];
  const de = `${r.de}-${b.de}`, en = `${r.en} ${b.en}`;
  return { ...b, n, base, form: region, types, de, en, name: localName(de, en), alt: LANG === "en" ? de : en };
});
const FORM_BY_N = new Map(ALL_FORMS.map(f => [f.n, f]));
const FORM_LIST = FORM_MODE ? ALL_FORMS : [];
const FORMS_OF = groupBy(FORM_LIST, f => f.base);  // Dex-Nummer -> ihre Formen

// Alle Slots im Binder (Pokédex, dahinter die Formen) und alle Nummern, die gespeichert sein dürfen.
const SLOTS = [...DEX, ...FORM_LIST];
const BY_N = new Map(SLOTS.map(p => [p.n, p]));
const KNOWN_N = new Set([...DEX_BY_N.keys(), ...FORM_BY_N.keys()]);

// Formen zeigen die Nummer ihrer Grundform.
const baseOf = n => FORM_BY_N.get(n)?.base ?? n;
const pad = n => "#" + String(baseOf(n)).padStart(4, "0");
const spriteUrl = n => SPRITES[n] || window.FORM_SPRITES?.[n] || SPRITES[baseOf(n)] || "";

// ---------- Sets ----------
// TCG_SETS[i] = [id, englischer Name, Serie, Erscheinung (JJJJ-MM), Kartenanzahl, deutscher Name, TCGdex-id]
const SETS = TCG_SETS.map(([id, en, series, date, total, de, tcgdex]) =>
  ({ id, en, de, series, date, year: date.slice(0, 4), total, tcgdex, name: localName(de, en) }));
const setName = i => SETS[i].name;
const isBooster = i => !NON_BOOSTER.test(SETS[i].en);

// Set-Logo (Booster-Bild in Kartenliste und Einkaufshilfe): TCGdex deutsch, TCGdex englisch,
// pokemontcg.io englisch (nur lokal: online liefert es für unbekannte Sets eine Kartenrückseite).
function logoSources(i) {
  const { id, tcgdex } = SETS[i];
  const de = window.LOCAL_LOGOS_DE?.includes(tcgdex) ? `sources/logos-de/${tcgdex}.webp` : "";
  const tcgdexEn = window.LOCAL_LOGOS_EN?.includes(tcgdex) ? `sources/logos-en/${tcgdex}.webp`
    : window.TCGDEX_DE?.[tcgdex] ? `${window.TCGDEX_DE[tcgdex].replace("/de/", "/en/")}/logo.webp` : "";
  const ptcg = window.LOCAL_IMAGES ? `images/logos/${id}.png` : "";
  return (LANG === "en" ? [tcgdexEn, ptcg, de] : [de, tcgdexEn, ptcg]).filter(Boolean);
}

// ---------- Kartenbilder ----------
const IMG_HOST = "https://images.pokemontcg.io/";
const safeName = s => s.replace(/[^A-Za-z0-9_-]/g, "_");  // wie safe_name in tools/common.py

// Bildquellen der Reihe nach: lokales Bild der gewählten Sprache, dann das der anderen,
// zuletzt online. Lokal: images/ (tools/download_images.py), sources/images-de/ (tools/download_german.py).
// big: große Bilder für die Vollansicht (nur online: TCGdex high.webp, pokemontcg.io _hires.png).
// srcsBy/bigBy: dieselben Listen je Kartensprache (der Binder zeigt das Bild in der Sprache der eigenen Karte).
function imageSources(setId, num, img, deSet, deNum) {
  const de = window.LOCAL_IMAGES_DE && deSet && deNum ? `sources/images-de/${deSet}/${safeName(deNum)}.webp` : "";
  const en = window.LOCAL_IMAGES ? `images/${setId}/${safeName(num)}.png` : "";
  const online = img?.startsWith("http") ? img : IMG_HOST + (img || `${setId}/${num}.png`);
  const deBase = window.TCGDEX_DE?.[deSet];
  const deBig = deBase && deNum ? `${deBase}/${deNum}/high.webp` : "";
  const enBig = online.replace(/\.png$/, "_hires.png");
  const byLang = (deFirst, enFirst) => ({ de: deFirst.filter(Boolean), en: enFirst.filter(Boolean) });
  const srcsBy = byLang([de, en, online], [en, de, online]), bigBy = byLang([deBig, enBig], [enBig, deBig]);
  const own = LANG === "en" ? "en" : "de";
  return { srcs: srcsBy[own], big: bigBy[own], srcsBy, bigBy };
}

// ---------- Karten ----------
// TCG_CARDS[Dex] = [[Set-Index, Nummer, Kategorie, englischer Name, Seltenheit-Index, Bildpfad, deutscher Name, TCGdex-Nummer, Illustrator-Index], …]
function decodeCard([setIdx, num, cat, nameEn, rarityIdx, img, nameDe, deNum, artistIdx]) {
  const set = SETS[setIdx];
  return {
    id: `${set.id}-${num}`, artist: window.TCG_ARTISTS?.[artistIdx] || "", date: set.date, year: set.year, total: set.total, num, cat, setIdx, rarity: TCG_RARITY_NAMES[rarityIdx],
    tcgdex: `${set.tcgdex}-${deNum || num}`,  // für Preise (js/prices.js)
    name: localName(nameDe, nameEn), set: set.name, ...imageSources(set.id, num, img, set.tcgdex, deNum),
    keys: [nameEn, nameDe, set.en, set.de].map(s => norm(s || "")).join(" "),  // für die Kartensuche
  };
}

// Formkarte? Name wie FORM_REGIONS[].card, aber kein Tag Team („&“).
const isFormCard = (form, nameEn) => FORM_REGION[form.form].card.test(nameEn) && !nameEn.includes(" & ");
// Rohdaten der Karten eines Slots: bei einer Form ihre Karten aus denen der Grundform,
// sonst alle Karten außer denen, die einen eigenen Formen-Slot haben.
function rawCardsFor(n) {
  const form = FORM_BY_N.get(n);
  if (form) return (TCG_CARDS[form.base] || []).filter(c => isFormCard(form, c[3]));
  const forms = FORMS_OF.get(n) || [];
  return (TCG_CARDS[n] || []).filter(c => !forms.some(f => isFormCard(f, c[3])));
}
// Formen-Slot, in den die Karte gehört (nur mit Formen-Anhang), sonst nichts.
function formSlotOf(n, cardId) {
  const raw = (TCG_CARDS[n] || []).find(c => `${SETS[c[0]].id}-${c[1]}` === cardId);
  return raw && (FORMS_OF.get(n) || []).find(f => isFormCard(f, raw[3]))?.n;
}

// Alle Karten eines Slots, nach Stufe und dann Erscheinungsdatum.
const cardCache = new Map();
function cardsFor(n) {
  if (!cardCache.has(n)) {
    const cards = rawCardsFor(n).map(decodeCard);
    cards.sort((a, b) => RARITY[a.cat].tierRank - RARITY[b.cat].tierRank || a.setIdx - b.setIdx || byCardNumber(a, b));
    cardCache.set(n, cards);
  }
  return cardCache.get(n);
}
const byCardNumber = (a, b) => a.num.localeCompare(b.num, "en", { numeric: true });
const findCard = (n, id) => (id ? cardsFor(n).find(c => c.id === id) : undefined);

// Karte über den gedruckten Setnamen (Deutsch oder Englisch) und die Kartennummer, z. B. aus einer CSV.
function findCardByPrint(n, setLabel, num) {
  const low = s => (s || "").trim().toLowerCase();
  const [set, number] = [low(setLabel), low(num)];
  if (!set || !number) return undefined;
  return cardsFor(n).find(c => c.num.toLowerCase() === number && [SETS[c.setIdx].en, SETS[c.setIdx].de].some(s => low(s) === set));
}

// Alle Karten einmal (eine Karte kann mehreren Pokémon gehören: ns), nach id abrufbar.
let allCardsCache = null;
function allCards() {
  if (!allCardsCache) {
    const byId = new Map();
    for (const p of SLOTS) for (const c of cardsFor(p.n)) {
      const known = byId.get(c.id);
      if (known) { known.ns.push(p.n); known.keys += ` ${norm(p.de)} ${norm(p.en)}`; }
      else byId.set(c.id, { ...c, ns: [p.n], keys: `${c.keys} ${norm(p.de)} ${norm(p.en)} ${norm(c.num)}` });
    }
    allCardsCache = byId;
  }
  return allCardsCache;
}
const cardById = id => allCards().get(id);

// Kartensuche: jedes Wort muss vorkommen (Pokémon-, Karten-, Setname in DE/EN oder Nummer).
function searchCards(query) {
  const words = query.split(/\s+/).map(norm).filter(Boolean);
  const cards = [...allCards().values()];
  return words.length ? cards.filter(c => words.every(w => c.keys.includes(w))) : cards;
}

// ---------- Binder ----------
// Alle Slots hintereinander, Index 0 = #1. Der Formen-Anhang beginnt auf der ersten neuen Seite
// hinter dem Pokédex. Kommen neue Pokémon dazu, rutscht er seitenweise nach hinten.
const FORM_START = Math.ceil(MAX_N / LAYOUT.slotsPerPage) * LAYOUT.slotsPerPage;
const FORM_INDEX = new Map(FORM_LIST.map((f, i) => [f.n, FORM_START + i]));
const SLOT_TOTAL = FORM_LIST.length ? FORM_START + FORM_LIST.length : MAX_N;
const slotIndex = n => FORM_INDEX.get(n) ?? n - 1;
// Nummer am Index i: Dex-Nummer (dahinter frei für neue Pokémon), Form oder null (leer).
const slotAt = i => (i < FORM_START ? i + 1 : FORM_LIST[i - FORM_START]?.n ?? null);

const binderOffset = binder => (binder === 2 ? LAYOUT.binder1Size : 0);
const binderOf = n => (slotIndex(n) < LAYOUT.binder1Size ? 1 : 2);
const inBinder = (binder, n) => binderOf(n) === binder;
const slotsInBinder = binder => SLOTS.filter(p => inBinder(binder, p.n));

// Position eines Slots: Binder, Seite, Reihe und Spalte (alles ab 1).
function locate(n) {
  const binder = binderOf(n);
  const i = slotIndex(n) - binderOffset(binder);
  const slot = i % LAYOUT.slotsPerPage;
  return { binder, page: Math.floor(i / LAYOUT.slotsPerPage) + 1, row: Math.floor(slot / LAYOUT.cols) + 1, col: (slot % LAYOUT.cols) + 1 };
}
const firstOnPage = (binder, page) => binderOffset(binder) + (page - 1) * LAYOUT.slotsPerPage;  // Index
const pageNumbers = (binder, page) => range(LAYOUT.slotsPerPage, firstOnPage(binder, page)).map(slotAt);
const pageCount = binder => Math.max(1, Math.ceil(
  (binder === 1 ? Math.min(SLOT_TOTAL, LAYOUT.binder1Size) : SLOT_TOTAL - LAYOUT.binder1Size) / LAYOUT.slotsPerPage));

const slotText = ({ row, col }) => `${t("rows")[row - 1]} ${t("cols")[col - 1]}`;
// "B1 · S. 3 · oben links"
const whereText = n => { const loc = locate(n); return t("where", { b: loc.binder, p: loc.page, slot: slotText(loc) }); };

// ---------- Suche ----------
const norm = s => s.toLowerCase().replace(/♀/g, "w").replace(/♂/g, "m")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
const SEARCH_INDEX = SLOTS.map(p => ({ p, keys: [norm(p.de), norm(p.en)] }));

// Treffer nach Güte: exakt, Anfang, irgendwo. Zahlen suchen die Dex-Nummer (mit ihren Formen).
function search(query, limit = 12) {
  const q = query.trim().replace(/^#/, "");
  if (/^\d+$/.test(q)) return DEX_BY_N.has(+q) ? [DEX_BY_N.get(+q), ...(FORMS_OF.get(+q) || [])] : [];
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
