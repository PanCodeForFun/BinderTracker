// Einstellungen. Alles, was man anpassen möchte, steht hier.

const LAYOUT = {
  slotsPerPage: 16,  // 4 x 4
  cols: 4,
  binder1Size: 640,  // Binder 1: #1 bis #640, danach Binder 2
};

const STORAGE_KEY = "pokebinder.v1";  // Browser-Speicher
const DB_COLLECTION = "karten";       // Online-Speicher (nur claude.ai)

// Sprache der eigenen Karte (Menü „…“ am Slot). Deutsch ist Standard und wird nicht gespeichert.
const CARD_LANGS = [
  { id: "de", short: "DE", label: "Deutsch" },
  { id: "en", short: "EN", label: "English" },
  { id: "ja", short: "JP", label: "日本語" },
];
const DEFAULT_CARD_LANG = "de";
const CARD_LANG = Object.fromEntries(CARD_LANGS.map(l => [l.id, l]));

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
