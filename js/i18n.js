// Sprache der Oberfläche und der Karten-/Pokémon-Namen. Standard: Deutsch.

const LANG_KEY = "pokebinder.lang";
const LANGS = [
  { id: "de", label: "Deutsch" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語 (folgt)", disabled: true },
];
let LANG = "de";
try { LANG = LANGS.find(l => l.id === localStorage.getItem(LANG_KEY) && !l.disabled)?.id || "de"; } catch { /* kein Speicher */ }

const STRINGS = {
  de: {
    title: "Pokémon Binder Tracker",
    stats: "Statistik", backupSave: "Backup speichern", backupSaveTip: "Sammlung als Datei sichern",
    backupLoad: "Backup laden", backupLoadTip: "Gesicherte Datei wieder laden", language: "Sprache",
    page: "Seite", overview: "Übersicht", show: "Anzeigen", all: "alle", onlyMissing: "nur fehlende", onlyHave: "nur vorhandene",
    searchPh: "Pokémon suchen (Deutsch, Englisch oder Nummer)…", searchLabel: "Pokémon suchen",
    prevPage: "Vorherige Seite", nextPage: "Nächste Seite", close: "Schließen",
    note: "Notiz", notePh: "z. B. Zustand, Sprache, gekauft bei …", clearSlot: "Slot leeren",
    noDesign: "Ohne Design", noDesignRarity: "Seltenheit ohne Design", load: "Laden", cancel: "Abbrechen",
    freeSlot: "frei für neue Pokémon", free: "frei", pickCard: "+ Karte wählen",
    pageTitle: "Binder {b} · Seite {p}", range: "{a} bis {b}", inBinder: "{a} / {b} im Binder", of: "von {n}",
    cardsKnown: "{n} Karten bekannt", noCards: "Keine Karten bekannt. Nutze „Ohne Design“.",
    noRarity: "ohne Angabe", reverseTip: "Diese Karte als Reverse Holo",
    rarerHint: "Hinweis: {a} war seltener als {b}.", saveFailed: "Online-Speichern fehlgeschlagen",
    total: "gesamt", byRarity: "Nach Seltenheit", withDesign: "{a} von {b} Karten mit gewähltem Kartendesign.",
    nothingFound: "Nichts gefunden", missingYet: "fehlt noch", where: "B{b} · S. {p} · {slot}",
    backupSaved: "Backup gespeichert.", backupNotSaved: "Backup wurde nicht gespeichert.",
    backupAsk: "Backup mit {n} Karten laden? Deine aktuellen Einträge werden ersetzt.",
    backupLoaded: "Backup geladen.", backupInvalid: "Die Datei ist kein gültiges Backup.",
    savedLocal: "Gespeichert in diesem Browser", connecting: "Verbinde…", liveWait: "Online-Speicher noch nicht erreichbar",
    live: "Live gespeichert", liveErr: "Online-Speicher nicht verfügbar",
    rows: ["oben", "2. Reihe", "3. Reihe", "unten"], cols: ["links", "2. von links", "3. von links", "rechts"],
  },
  en: {
    title: "Pokémon Binder Tracker",
    stats: "Statistics", backupSave: "Save backup", backupSaveTip: "Save the collection as a file",
    backupLoad: "Load backup", backupLoadTip: "Restore a saved file", language: "Language",
    page: "Page", overview: "Overview", show: "Show", all: "all", onlyMissing: "missing only", onlyHave: "owned only",
    searchPh: "Search Pokémon (English, German or number)…", searchLabel: "Search Pokémon",
    prevPage: "Previous page", nextPage: "Next page", close: "Close",
    note: "Note", notePh: "e.g. condition, language, bought at …", clearSlot: "Clear slot",
    noDesign: "No design", noDesignRarity: "Rarity without design", load: "Load", cancel: "Cancel",
    freeSlot: "free for new Pokémon", free: "free", pickCard: "+ Choose card",
    pageTitle: "Binder {b} · Page {p}", range: "{a} to {b}", inBinder: "{a} / {b} in binder", of: "of {n}",
    cardsKnown: "{n} cards known", noCards: "No cards known. Use “No design”.",
    noRarity: "not specified", reverseTip: "This card as Reverse Holo",
    rarerHint: "Note: {a} was rarer than {b}.", saveFailed: "Online save failed",
    total: "total", byRarity: "By rarity", withDesign: "{a} of {b} cards with a chosen card design.",
    nothingFound: "Nothing found", missingYet: "missing", where: "B{b} · P. {p} · {slot}",
    backupSaved: "Backup saved.", backupNotSaved: "Backup was not saved.",
    backupAsk: "Load backup with {n} cards? Your current entries will be replaced.",
    backupLoaded: "Backup loaded.", backupInvalid: "This file is not a valid backup.",
    savedLocal: "Saved in this browser", connecting: "Connecting…", liveWait: "Online storage not reachable yet",
    live: "Saved live", liveErr: "Online storage unavailable",
    rows: ["top", "2nd row", "3rd row", "bottom"], cols: ["left", "2nd from left", "3rd from left", "right"],
  },
};

// t("pageTitle", { b: 1, p: 3 }) -> "Binder 1 · Seite 3"
const t = (key, vars = {}) => {
  const s = STRINGS[LANG][key] ?? STRINGS.de[key] ?? key;
  return typeof s === "string" ? s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "") : s;
};

// Feste Texte in index.html: data-i18n (Text), data-i18n-ph (Platzhalter), data-i18n-tip (title + aria-label).
function applyStaticText() {
  document.documentElement.lang = LANG;
  document.title = t("title");
  document.querySelectorAll("[data-i18n]").forEach(el => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-ph]").forEach(el => (el.placeholder = t(el.dataset.i18nPh)));
  document.querySelectorAll("[data-i18n-tip]").forEach(el => {
    el.title = t(el.dataset.i18nTip);
    if (!/\w/.test(el.textContent)) el.setAttribute("aria-label", t(el.dataset.i18nTip));  // nur ohne sichtbaren Text
  });
}

function setLang(id) {
  try { localStorage.setItem(LANG_KEY, id); } catch { /* egal */ }
  location.reload();  // Namen und Kartenlisten neu aufbauen
}
