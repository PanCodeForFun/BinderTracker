// Pokédex, Sets, Karten, Binder-Positionen und Suche. Die Rohdaten stehen in data/*.js
// (erzeugt von tools/build_data.py), hier werden sie in handliche Objekte übersetzt.

// ---------- Pokédex ----------
// name = Anzeigename in der gewählten Sprache, alt = der andere Name
const DEX = POKEDEX.map(([n, de, en, gen, types = [], kind = ""]) => ({ n, de, en, gen, types, kind, name: localName(de, en), alt: LANG === "en" ? de : en }));
const DEX_BY_N = new Map(DEX.map(p => [p.n, p]));
const MAX_N = DEX[DEX.length - 1].n;

// ---------- Sonderkarten (Binder 3) ----------
// Regionalformen, Megas, Proto-Formen (data/forms.js) und Tag Teams haben dort einen Zweitslot mit
// eigener Nummer (z. B. 10026 = Alola-Raichu). Ihre Karten bleiben auch beim normalen Pokémon wählbar.
// special = Art (FORM_REGIONS[].id oder "tagteam"), base = Dex-Nummer für die Anzeige, members = Dex-Nummern.
const named = (p, de, en) => ({ ...p, de, en, name: localName(de, en), alt: LANG === "en" ? de : en });
const FORMS_3 = (window.FORMS || []).filter(([, base, region]) => DEX_BY_N.has(base) && FORM_REGION[region]).map(([n, base, region, types]) => {
  const b = DEX_BY_N.get(base), r = FORM_REGION[region];
  return named({ ...b, n, base, members: [base], special: region, types }, `${r.de}-${b.de}`, `${r.en} ${b.en}`);
});

// Feste Nummer aus dem englischen Namen (bleibt gleich, auch wenn neue Karten dazukommen): start + 0…999999.
function idsFromNames(start) {
  const used = new Set();
  return en => {
    let h = 0;
    for (const ch of en) h = (h * 31 + ch.codePointAt(0)) % 1000000;
    while (used.has(h)) h = (h + 1) % 1000000;
    used.add(h);
    return start + h;
  };
}

// Tag Teams aus den Kartendaten: ein Slot pro Team („Pikachu & Zekrom“), egal ob GX oder LEGEND.
const tagTeamOf = nameEn => (nameEn.includes(" & ") ? nameEn.replace(/[- ](GX|LEGEND)$/, "") : null);
function buildTagTeams() {
  const teams = new Map();
  for (const [n, cards] of Object.entries(TCG_CARDS)) for (const c of cards) {
    const en = tagTeamOf(c[3]);
    if (!en) continue;
    const team = teams.get(en) || { en, de: "", members: [] };
    if (!team.members.includes(+n)) team.members.push(+n);
    team.de ||= (c[6] || "").replace(/[- ](GX|LEGENDE?)$/i, "");
    teams.set(en, team);
  }
  const idOf = idsFromNames(7000000);
  return [...teams.values()]
    .map(team => ({ ...team, members: team.members.sort((a, b) => a - b) }))
    .sort((a, b) => a.members[0] - b.members[0] || a.en.localeCompare(b.en))
    .map(({ en, de, members }) => {
      const b = DEX_BY_N.get(members[0]);
      return named({ ...b, n: idOf(en), base: members[0], members, special: "tagteam", kind: "",
        gen: Math.max(...members.map(m => DEX_BY_N.get(m).gen)) }, de || en, en);
    });
}
const SPECIALS = [...FORMS_3, ...buildTagTeams()];
const SPECIAL_BY_N = new Map(SPECIALS.map(p => [p.n, p]));
const SPECIALS_OF = new Map();  // Dex-Nummer -> ihre Sonderkarten-Slots (für die Suche)
for (const p of SPECIALS) for (const m of p.members) SPECIALS_OF.set(m, [...(SPECIALS_OF.get(m) || []), p]);

// ---------- Trainerkarten (Binder 4 und folgende) ----------
// Ein Slot pro Kartenname (Varianten wie „Professor's Research (Professor Oak)“ zusammen), in der
// Reihenfolge des ersten Erscheinens. Neue Karten hängen hinten an. TCG_TRAINERS ist nach Set sortiert.
const trainerName = name => (name || "").replace(/\s*\(.*\)$/, "");
const TRAINER_CARDS = new Map();  // Slot-Nummer -> Rohdaten der Karten
function buildTrainers() {
  const byName = new Map(), idOf = idsFromNames(8000000);
  for (const c of window.TCG_TRAINERS || []) {
    const en = trainerName(c[3]);
    if (!byName.has(en)) byName.set(en, { en, de: "", type: c[9], cards: [] });
    const slot = byName.get(en);
    slot.de ||= trainerName(c[6]);
    slot.cards.push(c);
  }
  return [...byName.values()].map(({ en, de, type, cards }, i) => {
    const n = idOf(en);
    TRAINER_CARDS.set(n, cards);
    return named({ n, pos: i + 1, special: "trainer", trainerType: type, types: [], members: [], kind: "" }, de || en, en);
  });
}
const TRAINERS = buildTrainers();
const TRAINER_INDEX = new Map(TRAINERS.map((p, i) => [p.n, i]));

// Alle Slots (Pokédex, Sonderkarten, Trainer), nach Nummer abrufbar.
const SLOTS = [...DEX, ...SPECIALS, ...TRAINERS];
const BY_N = new Map(SLOTS.map(p => [p.n, p]));

// Sonderkarten zeigen die Nummer ihres (ersten) Pokémon, Trainer ihre Reihenfolge (T0001).
const baseOf = n => SPECIAL_BY_N.get(n)?.base ?? n;
const pad = n => (TRAINER_INDEX.has(n) ? "T" + String(TRAINER_INDEX.get(n) + 1).padStart(4, "0") : "#" + String(baseOf(n)).padStart(4, "0"));
// Trainer bekommen statt eines Pokémon-Bilds eine Kartenskizze mit „T“.
const TRAINER_ICON = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect x="26" y="12" width="44" height="72" rx="5" fill="#e8e3d6" stroke="#8a8170" stroke-width="3"/>
  <text x="48" y="58" font-family="sans-serif" font-size="30" font-weight="700" text-anchor="middle" fill="#8a8170">T</text></svg>`);
const spriteUrl = n => (TRAINER_INDEX.has(n) ? TRAINER_ICON : SPRITES[n] || window.FORM_SPRITES?.[n] || SPRITES[baseOf(n)] || "");

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

// Karte einer Form? Name wie FORM_REGIONS[].card, aber kein Tag Team („&“).
const isFormCard = (region, nameEn) => FORM_REGION[region].card.test(nameEn) && !nameEn.includes(" & ");
// Rohdaten der Karten eines Slots. Sonderkarten nehmen ihre Karten aus denen ihres Pokémon.
function rawCardsFor(n) {
  if (TRAINER_CARDS.has(n)) return TRAINER_CARDS.get(n);
  const sp = SPECIAL_BY_N.get(n);
  if (!sp) return TCG_CARDS[n] || [];
  const cards = TCG_CARDS[sp.base] || [];
  return sp.special === "tagteam" ? cards.filter(c => tagTeamOf(c[3]) === sp.en) : cards.filter(c => isFormCard(sp.special, c[3]));
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
// Binder 1: #1 bis #640, Binder 2: ab #641 (wächst mit neuen Pokémon, dahinter frei),
// Binder 3: Sonderkarten (Zweitslots, siehe oben), ab Binder 4: Trainerkarten (je trainerBinderSize Slots).
const SPECIAL_BINDER = 3, TRAINER_BINDER = 4;
const TRAINER_SIZE = LAYOUT.trainerBinderSize;
const BINDERS = [1, 2, SPECIAL_BINDER, ...range(Math.max(1, Math.ceil(TRAINERS.length / TRAINER_SIZE)), TRAINER_BINDER)];
const SPECIAL_INDEX = new Map(SPECIALS.map((p, i) => [p.n, i]));
const isTrainerBinder = binder => binder >= TRAINER_BINDER;
const binderOffset = binder => (binder === 2 ? LAYOUT.binder1Size : isTrainerBinder(binder) ? (binder - TRAINER_BINDER) * TRAINER_SIZE : 0);
function binderOf(n) {
  if (SPECIAL_INDEX.has(n)) return SPECIAL_BINDER;
  if (TRAINER_INDEX.has(n)) return TRAINER_BINDER + Math.floor(TRAINER_INDEX.get(n) / TRAINER_SIZE);
  return n <= LAYOUT.binder1Size ? 1 : 2;
}
const inBinder = (binder, n) => binderOf(n) === binder;
const slotsInBinder = binder => SLOTS.filter(p => inBinder(binder, p.n));
function binderSize(binder) {
  if (binder === SPECIAL_BINDER) return SPECIALS.length;
  if (isTrainerBinder(binder)) return Math.min(TRAINER_SIZE, TRAINERS.length - binderOffset(binder));
  return binder === 1 ? Math.min(MAX_N, LAYOUT.binder1Size) : MAX_N - LAYOUT.binder1Size;
}
// Nummer am Platz i (ab 0) eines Binders: Dex-Nummer (hinter dem Pokédex frei für neue Pokémon),
// Sonderkarte, Trainer oder null (leer).
function slotAt(binder, i) {
  if (binder === SPECIAL_BINDER) return SPECIALS[i]?.n ?? null;
  if (isTrainerBinder(binder)) return i < TRAINER_SIZE ? TRAINERS[binderOffset(binder) + i]?.n ?? null : null;
  return binderOffset(binder) + i + 1;
}
// Platz eines Slots in seinem Binder (ab 0)
const indexInBinder = n => SPECIAL_INDEX.get(n) ?? (TRAINER_INDEX.has(n) ? TRAINER_INDEX.get(n) : n - 1) - binderOffset(binderOf(n));

// Position eines Slots: Binder, Seite, Reihe und Spalte (alles ab 1).
function locate(n) {
  const binder = binderOf(n), i = indexInBinder(n);
  const slot = i % LAYOUT.slotsPerPage;
  return { binder, page: Math.floor(i / LAYOUT.slotsPerPage) + 1, row: Math.floor(slot / LAYOUT.cols) + 1, col: (slot % LAYOUT.cols) + 1 };
}
// Reihenfolge über alle Binder (zum Sortieren nach Binderplatz)
const slotOrder = n => binderOf(n) * 1e5 + indexInBinder(n);
const pageNumbers = (binder, page) => range(LAYOUT.slotsPerPage, (page - 1) * LAYOUT.slotsPerPage).map(i => slotAt(binder, i));
const pageCount = binder => Math.max(1, Math.ceil(binderSize(binder) / LAYOUT.slotsPerPage));

const slotText = ({ row, col }) => `${t("rows")[row - 1]} ${t("cols")[col - 1]}`;
// "B1 · S. 3 · oben links"
const whereText = n => { const loc = locate(n); return t("where", { b: loc.binder, p: loc.page, slot: slotText(loc) }); };

// ---------- Suche ----------
const norm = s => s.toLowerCase().replace(/♀/g, "w").replace(/♂/g, "m")
  .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
const SEARCH_INDEX = SLOTS.map(p => ({ p, keys: [norm(p.de), norm(p.en)] }));

// Treffer nach Güte: exakt, Anfang, irgendwo. Zahlen suchen die Dex-Nummer (mit ihren Sonderkarten).
function search(query, limit = 12) {
  const q = query.trim().replace(/^#/, "");
  if (/^\d+$/.test(q)) return DEX_BY_N.has(+q) ? [DEX_BY_N.get(+q), ...(SPECIALS_OF.get(+q) || [])] : [];
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
