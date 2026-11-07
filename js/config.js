// Einstellungen. Alles, was man anpassen möchte, steht hier.

const LAYOUT = {
  slotsPerPage: 16,  // 4 x 4
  cols: 4,
  binder1Size: 640,  // Binder 1: #1 bis #640, danach Binder 2
};

const STORAGE_KEY = "pokebinder.v1";  // Browser-Speicher
const DB_COLLECTION = "karten";       // Online-Speicher (nur claude.ai)

// Von häufig nach selten. Die id wird gespeichert, Label und Farbe sind frei.
// pool: welche Kartenkategorien aus data/cards.js zur Auswahl stehen.
const RARITIES = [
  { id: "normal",  label: "Normal",                    hint: "Common, Uncommon, Rare", color: "#9aa3ad", ink: "#111", pool: ["normal"] },
  { id: "reverse", label: "Reverse Holo",              hint: "Glitzer im Rahmen",      color: "#7cc4c9", ink: "#111", pool: ["normal", "holo"] },
  { id: "holo",    label: "Holo",                      hint: "Glitzer im Bild",        color: "#4f9fe0", ink: "#fff", pool: ["holo"] },
  { id: "promo",   label: "Promo",                     hint: "Promokarten",            color: "#6b8f5e", ink: "#fff", pool: ["promo"] },
  { id: "shiny",   label: "Shiny",                     hint: "Shiny, Radiant, Amazing", color: "#2bb39b", ink: "#fff", pool: ["shiny"] },
  { id: "ex",      label: "EX / GX / V / ex",          hint: "Regelkarten",            color: "#8a5cd6", ink: "#fff", pool: ["ex"] },
  { id: "vmax",    label: "VMAX / VSTAR",              hint: "",                       color: "#b04fc4", ink: "#fff", pool: ["vmax"] },
  { id: "fullart", label: "Full Art",                  hint: "Ultra Rare",             color: "#e0559a", ink: "#fff", pool: ["fullart"] },
  { id: "ir",      label: "Illustration Rare",         hint: "inkl. Trainer Gallery",  color: "#f07a3a", ink: "#111", pool: ["ir"] },
  { id: "sir",     label: "Special Illustration Rare", hint: "SAR",                    color: "#e2402f", ink: "#fff", pool: ["sir"] },
  { id: "hyper",   label: "Hyper / Gold / Rainbow",    hint: "Secret Rare",            color: "#d4a514", ink: "#111", pool: ["hyper"] },
];
const RARITY = Object.fromEntries(RARITIES.map((r, rank) => [r.id, { ...r, rank }]));
