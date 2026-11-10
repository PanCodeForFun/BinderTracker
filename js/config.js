// Einstellungen. Alles, was man anpassen möchte, steht hier.

const LAYOUT = {
  slotsPerPage: 16,  // 4 x 4
  cols: 4,
  binder1Size: 640,  // Binder 1: #1 bis #640, danach Binder 2
};

// Browser-Speicher (localStorage) und Online-Speicher (nur claude.ai)
const STORAGE_KEY = "pokebinder.v1";         // Sammlung
const WISH_KEY = STORAGE_KEY + ".wunsch";    // Wunschliste
const PRICE_KEY = STORAGE_KEY + ".preise";   // zwischengespeicherte Kartenpreise
const LANG_KEY = "pokebinder.lang";          // Sprache der Oberfläche
const FILTER_KEY = STORAGE_KEY + ".filter"; // gewählte Binder-Filter
const FORMS_KEY = STORAGE_KEY + ".formen";   // Formen-Anhang an/aus
const DB_COLLECTION = "karten";
const DB_WISH = "wunsch";

// Sprache der eigenen Karte (Menü „…“ am Slot). Deutsch ist Standard und wird nicht gespeichert.
const CARD_LANGS = [
  { id: "de", short: "DE", label: "Deutsch" },
  { id: "en", short: "EN", label: "English" },
  { id: "ja", short: "JP", label: "日本語" },
];
const DEFAULT_CARD_LANG = "de";
const CARD_LANG = Object.fromEntries(CARD_LANGS.map(l => [l.id, l]));

// Pokémon-Typen (Bezeichner wie in data/pokedex.js) mit Farbe für die Filter-Knöpfe.
const TYPES = [
  { id: "normal",   de: "Normal",  en: "Normal",   color: "#a8a77a" },
  { id: "fire",     de: "Feuer",   en: "Fire",     color: "#ee8130" },
  { id: "water",    de: "Wasser",  en: "Water",    color: "#6390f0" },
  { id: "grass",    de: "Pflanze", en: "Grass",    color: "#7ac74c" },
  { id: "electric", de: "Elektro", en: "Electric", color: "#e5c531" },
  { id: "ice",      de: "Eis",     en: "Ice",      color: "#96d9d6" },
  { id: "fighting", de: "Kampf",   en: "Fighting", color: "#c22e28" },
  { id: "poison",   de: "Gift",    en: "Poison",   color: "#a33ea1" },
  { id: "ground",   de: "Boden",   en: "Ground",   color: "#e2bf65" },
  { id: "flying",   de: "Flug",    en: "Flying",   color: "#a98ff3" },
  { id: "psychic",  de: "Psycho",  en: "Psychic",  color: "#f95587" },
  { id: "bug",      de: "Käfer",   en: "Bug",      color: "#a6b91a" },
  { id: "rock",     de: "Gestein", en: "Rock",     color: "#b6a136" },
  { id: "ghost",    de: "Geist",   en: "Ghost",    color: "#735797" },
  { id: "dragon",   de: "Drache",  en: "Dragon",   color: "#6f35fc" },
  { id: "dark",     de: "Unlicht", en: "Dark",     color: "#705746" },
  { id: "steel",    de: "Stahl",   en: "Steel",    color: "#b7b7ce" },
  { id: "fairy",    de: "Fee",     en: "Fairy",    color: "#d685ad" },
];

// Deutsche Namen der Serien (data/cards.js hat nur die englischen). Fehlende bleiben englisch.
const SERIES_DE = {
  "Other": "Sonstige", "Diamond & Pearl": "Diamant & Perl", "Platinum": "Platin", "Black & White": "Schwarz & Weiß",
  "Sun & Moon": "Sonne & Mond", "Sword & Shield": "Schwert & Schild", "Scarlet & Violet": "Karmesin & Purpur",
  "Mega Evolution": "Mega-Entwicklung",
};

// Formen-Anhang: Regionalformen und Megas bekommen eigene Slots hinter dem Pokédex in Binder 2
// (Schalter in den Optionen). Die Formen selbst stehen in data/forms.js, in dieser Reihenfolge.
// de/en: Namensteil („Alola-Raichu“, „Alolan Raichu“), card: so beginnt der englische Kartenname.
// Karten mit „&“ (Tag Team) bleiben beim normalen Pokémon.
const FORM_REGIONS = [
  { id: "alola",  de: "Alola",  en: "Alolan",   card: /^(Radiant )?Alolan / },
  { id: "galar",  de: "Galar",  en: "Galarian", card: /^(Radiant )?Galarian / },
  { id: "hisui",  de: "Hisui",  en: "Hisuian",  card: /^(Radiant )?Hisuian / },
  { id: "paldea", de: "Paldea", en: "Paldean",  card: /^(Radiant )?Paldean / },
  { id: "mega",   de: "Mega",   en: "Mega",     card: /^(M|Mega) / },
  { id: "primal", de: "Proto",  en: "Primal",   card: /^Primal / },
];
const FORM_REGION = Object.fromEntries(FORM_REGIONS.map(r => [r.id, r]));

// Besondere Pokémon (5. Feld in data/pokedex.js), Filter „Besonderheit“.
const KINDS = [
  { id: "legendary", de: "Legendär",   en: "Legendary" },
  { id: "mythical",  de: "Mysteriös",  en: "Mythical" },
  { id: "ultra",     de: "Ultrabestie", en: "Ultra Beast" },
  { id: "paradox",   de: "Paradox",    en: "Paradox" },
  { id: "baby",      de: "Baby",       en: "Baby" },
];

// Fünf Stufen von häufig nach selten. Sie bestimmen Gruppen, Farben und Statistik.
const TIERS = [
  { id: "base",   label: "Normal",                          color: "#9aa3ad", ink: "#111" },
  { id: "holo",   label: "Holo, Reverse & Promo",           color: "#4f9fe0", ink: "#fff" },
  { id: "rule",   label: "ex, V, GX & Co.",                 color: "#8a5cd6", ink: "#fff" },
  { id: "art",    label: "Full Art, Illustration & Shiny",  color: "#e0559a", ink: "#fff" },
  { id: "secret", label: "Special Illustration & Secret",   color: "#d4a514", ink: "#111" },
];

// Genaue Seltenheit, von häufig nach selten. Die id wird gespeichert und
// entspricht der Kartenkategorie in data/cards.js (außer reverse).
const RARITIES = [
  { id: "normal",  label: "Normal",                    tier: "base" },
  { id: "reverse", label: "Reverse Holo",              tier: "holo" },
  { id: "holo",    label: "Holo",                      tier: "holo" },
  { id: "promo",   label: "Promo",                     tier: "holo" },
  { id: "ex",      label: "EX / GX / V / ex",          tier: "rule" },
  { id: "vmax",    label: "VMAX / VSTAR",              tier: "rule" },
  { id: "shiny",   label: "Shiny",                     tier: "art" },
  { id: "fullart", label: "Full Art",                  tier: "art" },
  { id: "ir",      label: "Illustration Rare",         tier: "art" },
  { id: "sir",     label: "Special Illustration Rare", tier: "secret" },
  { id: "hyper",   label: "Hyper / Gold / Rainbow",    tier: "secret" },
];

// Upgrade-Markierung: Karten unter dieser Stufe will man automatisch noch ersetzen.
// Ab dieser Stufe setzt man den Haken „Will ich ersetzen“ selbst (Menü „…“ am Slot).
const UPGRADE_BELOW = "rule";

// Sets, die es nicht als Booster zu kaufen gibt (englischer Setname). Die Einkaufshilfe blendet sie aus.
const NON_BOOSTER = /Promo|Trainer Kit|McDonald|Futsal|Energies|Classic Collection|Kalos Starter|Best of Game|Rumble/i;

// Diese Kategorien gibt es auch als Reverse Holo.
const REVERSE_FROM = ["normal", "holo"];

// Zeichen wie unten auf der Karte. Nicht aufgeführte Seltenheiten bekommen ★.
const RARITY_SYMBOLS = [
  ["●", ["Common", "None"]],
  ["◆", ["Uncommon"]],
  ["P", ["Promo"]],
  ["✦✦", ["Shiny Ultra Rare"]],
  ["✦", ["Shiny Rare", "Rare Shiny", "Rare Shiny GX", "Radiant Rare", "Amazing Rare", "Rare Shining"]],
  ["★★★", ["Hyper Rare", "Rare Secret", "Rare Rainbow", "Mega Hyper Rare", "Black White Rare", "Futuristic Rare", "Pikachu Rare"]],
  ["★★", ["Double Rare", "Ultra Rare", "Rare Ultra", "Special Illustration Rare", "MEGA_ATTACK_RARE",
          "Rare Holo EX", "Rare Holo GX", "Rare Holo V", "Rare Holo VMAX", "Rare Holo VSTAR", "Rare Holo LV.X",
          "Rare BREAK", "Rare Prism Star", "Holo Rare V", "Holo Rare VMAX", "Holo Rare VSTAR"]],
];
const symbolFor = rarityName => RARITY_SYMBOLS.find(([, names]) => names.includes(rarityName))?.[0] || "★";

const TIER = Object.fromEntries(TIERS.map((t, rank) => [t.id, { ...t, rank }]));
const RARITY = Object.fromEntries(RARITIES.map((r, rank) => {
  const { color, ink, rank: tierRank } = TIER[r.tier];
  return [r.id, { ...r, rank, tierRank, color, ink }];
}));
