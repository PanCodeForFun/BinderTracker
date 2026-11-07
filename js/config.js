// Einstellungen. Alles, was man anpassen möchte, steht hier.

const LAYOUT = {
  slotsPerPage: 16,  // 4 x 4
  cols: 4,
  binder1Size: 640,  // Binder 1: #1 bis #640, danach Binder 2
};

const STORAGE_KEY = "pokebinder.v1";  // Browser-Speicher
const DB_COLLECTION = "karten";       // Online-Speicher (nur claude.ai)

// Von häufig nach selten. Die id wird gespeichert, Label und Farbe sind frei.
// Die id entspricht der Kartenkategorie in data/cards.js (außer reverse).
const RARITIES = [
  { id: "normal",  label: "Normal",                    color: "#9aa3ad", ink: "#111" },
  { id: "reverse", label: "Reverse Holo",              color: "#7cc4c9", ink: "#111" },
  { id: "holo",    label: "Holo",                      color: "#4f9fe0", ink: "#fff" },
  { id: "promo",   label: "Promo",                     color: "#6b8f5e", ink: "#fff" },
  { id: "shiny",   label: "Shiny",                     color: "#2bb39b", ink: "#fff" },
  { id: "ex",      label: "EX / GX / V / ex",          color: "#8a5cd6", ink: "#fff" },
  { id: "vmax",    label: "VMAX / VSTAR",              color: "#b04fc4", ink: "#fff" },
  { id: "fullart", label: "Full Art",                  color: "#e0559a", ink: "#fff" },
  { id: "ir",      label: "Illustration Rare",         color: "#f07a3a", ink: "#111" },
  { id: "sir",     label: "Special Illustration Rare", color: "#e2402f", ink: "#fff" },
  { id: "hyper",   label: "Hyper / Gold / Rainbow",    color: "#d4a514", ink: "#111" },
];

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

const RARITY = Object.fromEntries(RARITIES.map((r, rank) => [r.id, { ...r, rank }]));
