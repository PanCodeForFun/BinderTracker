// Filter für den Binder: Was nicht passt, wird abgedunkelt, bleibt aber an seinem Platz.
//
// Neuer Filter = neuer Eintrag in FILTERS:
//   id       Schlüssel, unter dem die Auswahl gespeichert wird
//   label    Textschlüssel (js/i18n.js) für die Überschrift
//   options  () => [[Wert, Text, Farbe?], …] zum Anklicken
//   value    (p, e, card) => Wert dieses Pokémon (oder Liste von Werten), null passt zu nichts.
//            p = Pokédex-Eintrag, e = eigener Eintrag (oder nichts), card = gewählte Karte (oder nichts)
// Innerhalb eines Filters reicht ein gewählter Wert (oder), über alle Filter muss jeder passen (und).

const typeOptions = () => TYPES.map(x => [x.id, localName(x.de, x.en), x.color]);
const yesNo = () => [["1", t("yes")], ["0", t("no")]];
const flag = x => (x ? "1" : "0");
const SERIES = [...new Set(SETS.map(s => s.series))];
// Werte aus deinen eingetragenen Karten, sortiert (für Set und Illustrator).
const ownedValues = (key, sort) => [...new Set(ownedCards().map(x => key(x.c)).filter(v => v != null && v !== ""))].sort(sort);
// Gibt es eine Karte aus einer selteneren Stufe als deine?
const rarerExists = (n, e) => cardsFor(n).some(c => RARITY[c.cat].tierRank > RARITY[e.r].tierRank);

const FILTERS = [
  { id: "gen", label: "fGen",
    options: () => [...new Set(DEX.map(p => p.gen))].map(g => [String(g), t("genN", { n: g })]),
    value: p => String(p.gen) },
  { id: "type", label: "fType", options: typeOptions, value: p => p.types[0] },
  { id: "type2", label: "fType2", options: () => [...typeOptions(), ["none", t("fNone")]], value: p => p.types[1] || "none" },
  { id: "kind", label: "fKind", options: () => [...KINDS.map(k => [k.id, localName(k.de, k.en)]), ["", t("fNone")]], value: p => p.kind },
  { id: "tier", label: "fTier", options: () => TIERS.map(x => [x.id, x.label, x.color]), value: (p, e) => e && RARITY[e.r].tier },
  { id: "series", label: "fSeries", options: () => SERIES.map(s => [s, localName(SERIES_DE[s], s)]), value: (p, e, card) => card && SETS[card.setIdx].series },
  { id: "set", label: "fSet",  // nur Sets, aus denen du schon eine Karte eingetragen hast
    options: () => ownedValues(c => c.setIdx, (a, b) => a - b).map(i => [String(i), setName(i)]),
    value: (p, e, card) => card && String(card.setIdx) },
  { id: "artist", label: "fArtist",  // nur Illustratoren deiner eingetragenen Karten
    options: () => ownedValues(c => c.artist, (a, b) => a.localeCompare(b)).map(a => [a, a]),
    value: (p, e, card) => card?.artist || null },
  { id: "rarer", label: "fRarer", options: yesNo, value: (p, e) => e && flag(rarerExists(p.n, e)) },
  { id: "design", label: "fDesign", options: yesNo, value: (p, e, card) => e && flag(card) },
  { id: "note", label: "fNote", options: yesNo, value: (p, e) => e && flag(e.note) },
];

// Auswahl „Anzeigen“ (alle, fehlende, vorhandene, Upgrades).
const SHOW = {
  all: () => true,
  missing: e => !e,
  have: e => !!e,
  upgrade: e => wantsUpgrade(e),
};

const chosen = id => view.filters[id] || [];
const activeFilters = () => FILTERS.filter(f => chosen(f.id).length);
const activeCount = () => FILTERS.reduce((sum, f) => sum + chosen(f.id).length, 0);
const anyFilter = () => view.filter !== "all" || activeCount() > 0;

// Passt das Pokémon n zu „Anzeigen“ und allen Filtern?
function matches(n, active = activeFilters()) {
  const p = BY_N.get(n), e = owned(n);
  if (!p || !SHOW[view.filter](e)) return false;
  const card = e && findCard(n, e.card);
  return active.every(f => [f.value(p, e, card)].flat().some(v => v != null && chosen(f.id).includes(v)));
}

// Wert an- oder abwählen, alles zurücksetzen. Die Auswahl bleibt im Browser gespeichert.
function toggleFilter(id, value) {
  const list = chosen(id);
  view.filters = { ...view.filters, [id]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] };
  writeJson(FILTER_KEY, view.filters);
}
function resetFilters() {
  view.filters = {};
  writeJson(FILTER_KEY, view.filters);
}
