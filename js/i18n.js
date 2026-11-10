// Sprache der Oberfläche und der Karten-/Pokémon-Namen. Standard: Deutsch.

const LANGS = [
  { id: "de", label: "Deutsch" },
  { id: "en", label: "English" },
  { id: "ja", label: "日本語 (folgt)", disabled: true },
];
const LANG = LANGS.find(l => l.id === storageGet(LANG_KEY) && !l.disabled)?.id || "de";

// Name in der Sprache der Oberfläche: Englisch nur bei "en", sonst Deutsch (ersatzweise Englisch).
const localName = (de, en) => (LANG === "en" ? en : de || en);

const STRINGS = {
  de: {
    title: "Pokémon Binder Tracker",
    binder: "Binder", data: "Optionen", backup: "Backup", storage: "Speicherort",
    languageHint: "Sprache der Oberfläche, Namen und Kartenbilder.",
    backupHint: "Sammlung und Wunschliste als Datei sichern oder wiederherstellen. Regelmäßig speichern!",
    stats: "Statistik", backupSave: "Backup speichern", backupSaveTip: "Sammlung als Datei sichern",
    backupLoad: "Backup laden", backupLoadTip: "Gesicherte Datei wieder laden (JSON-Backup oder CSV)", language: "Sprache",
    page: "Seite", overview: "Übersicht", show: "Anzeigen", all: "alle", onlyMissing: "nur fehlende", onlyHave: "nur vorhandene",
    searchPh: "Pokémon suchen (Deutsch, Englisch oder Nummer)…", searchLabel: "Pokémon suchen",
    prevPage: "Vorherige Seite", nextPage: "Nächste Seite", close: "Schließen",
    note: "Notiz", notePh: "z. B. Zustand, gekauft bei …", cardLang: "Sprache der Karte", moreTip: "Mehr zu dieser Karte", clearSlot: "Slot leeren",
    noDesign: "Ohne Design", noDesignRarity: "Seltenheit ohne Design", load: "Laden", cancel: "Abbrechen",
    freeSlot: "frei für neue Pokémon", free: "frei", pickCard: "+ Karte wählen",
    pageTitle: "Binder {b} · Seite {p}", range: "{a} bis {b}", inBinder: "{a} / {b} im Binder", of: "von {n}",
    cardsKnown: "{n} Karten bekannt", noCards: "Keine Karten bekannt. Nutze „Ohne Design“.",
    noRarity: "ohne Angabe", reverseTip: "Diese Karte als Reverse Holo",
    rarerHint: "Hinweis: {a} war seltener als {b}.", saveFailed: "Online-Speichern fehlgeschlagen",
    total: "gesamt", byRarity: "Nach Seltenheit", withDesign: "{a} von {b} Karten mit gewähltem Kartendesign.",
    nothingFound: "Nichts gefunden", missingYet: "fehlt noch", where: "B{b} · S. {p} · {slot}",
    backupSaved: "Backup gespeichert.", backupNotSaved: "Backup wurde nicht gespeichert.",
    csvSave: "Als CSV (Excel)", csvSaveTip: "Alle Pokémon als Tabelle für Excel. Lässt sich mit „Backup laden“ wieder einlesen (ohne Wunschliste).",
    csvSaved: "CSV gespeichert.", csvNotSaved: "CSV wurde nicht gespeichert.", yes: "ja", no: "nein",
    csvHead: "Nr|Name (DE)|Name (EN)|Generation|Binder|Seite|Reihe|Spalte|Vorhanden|Seltenheit|Stufe|Set|Kartennummer|Kartenname|Sprache|Upgrade|Wert (€)|Notiz",
    backupAsk: "Backup mit {n} Karten laden? Deine aktuellen Einträge werden ersetzt.",
    backupLoaded: "Backup geladen.", backupInvalid: "Die Datei ist kein gültiges Backup.",
    savedLocal: "Gespeichert in diesem Browser", connecting: "Verbinde…", liveWait: "Online-Speicher noch nicht erreichbar",
    live: "Live gespeichert", liveErr: "Online-Speicher nicht verfügbar",
    rows: ["oben", "2. Reihe", "3. Reihe", "unten"], cols: ["links", "2. von links", "3. von links", "rechts"],
    wish: "Wunschliste", cardList: "Kartenliste", wlHits: "{n} Karten", more: "Mehr anzeigen",
    wlSearchPh: "Karten suchen: Pokémon, Kartenname, Set oder Nummer …",
    wishAdd: "Auf die Wunschliste", wishRemove: "Von der Wunschliste nehmen", inBinderTag: "im Binder",
    wishEmpty: "Noch keine Wunschkarten. Tippe in der Kartenliste auf ★.",
    unwish: "Nicht mehr wünschen", wishedSince: "gewünscht seit {d}",
    allBoosters: "Alle Booster", boosterLabel: "Booster auswählen", nextBooster: "Nächstes Booster",
    sortLabel: "Sortierung", sortNew: "Neueste zuerst", sortOld: "Älteste zuerst", sortDex: "Pokédex-Nummer", sortRarity: "Seltenste zuerst",
    shop: "Einkaufshilfe",
    shopHint: "Booster-Vorschläge aus deiner Wunschliste: Sets mit den meisten Wunschkarten zuerst.",
    shopCount: "{n} Wunschkarten", shopOne: "1 Wunschkarte",
    shopSingles: "Nicht als Booster erhältlich (Promos, Trainer-Kits …), am besten einzeln kaufen",
    undoTip: "Rückgängig (Strg+Z)", redoTip: "Wiederholen (Strg+Y)", undone: "Rückgängig: {x}", redone: "Wiederholt: {x}",
    nothingUndo: "Nichts zum Rückgängigmachen", nothingRedo: "Nichts zum Wiederholen",
    wishOp: "Wunschliste: {x}", backupStep: "Backup laden",
    shopEmpty: "Noch keine Wunschkarten, also auch keine Vorschläge. Markiere Karten in der Kartenliste mit ★.",
    collection: "Sammlung", value: "Wert", approx: "ca. {v}", noPrice: "kein Preis bekannt",
    priceLoading: "Preis wird geladen…", priceFailed: "Preis nicht abrufbar",
    valueHint: "Grober Wert deiner eingetragenen Karten: Cardmarket-Trendpreis über TCGdex, ohne Unterscheidung nach Sprache und Zustand. Die Preise werden nur auf Knopfdruck abgefragt.",
    valueButton: "Binderwert ermitteln", valueLoading: "Lade Preise… {a} / {b}",
    valueCount: "{a} von {b} Karten mit Preis.", valueAsOf: "Stand: {d}.",
    valueNoDesign: "Ohne gewähltes Kartendesign und daher ohne Preis: {n}.",
    valueTop: "Die 10 wertvollsten Karten",
    upgrades: "Upgrades", onlyUpgrades: "nur Upgrades", upTag: "Upgrade gesucht", upToggle: "Will ich ersetzen",
    upAuto: "Wird automatisch ersetzt (alles unter „{x}“).", upManual: "von Hand markiert",
    upHint: "Karten, die du durch eine bessere ersetzen willst: von Hand markiert (Menü „…“ am Slot) oder mit Karten auf der Wunschliste. Alles unter „{x}“ ist automatisch ein Upgrade und hat nur das ↑ am Slot.",
    upCount: "{n} Pokémon ({m} von Hand markiert, {w} mit Wunschkarten)", upEmpty: "Keine Upgrades offen. Markiere Karten im Menü „…“ oder setze Karten auf die Wunschliste.",
    upSortCommon: "Häufigste zuerst", pricesFailed: "{n} Preise konnten nicht abgerufen werden.",
    fBtn: "Filter", fReset: "Filter zurücksetzen", fRemove: "Filter entfernen", fMatch: "{a} von {b} passen",
    fHint: "Mehrere Werte in einer Gruppe: eins davon reicht. Seltenheit, Serie, Set, Design und Notiz beziehen sich auf deine eingetragene Karte.",
    fGen: "Generation", genN: "Gen {n}", fType: "Primärtyp", fType2: "Zweittyp", fNone: "keiner",
    fTier: "Seltenheit", fSeries: "Serie", fSet: "Set deiner Karte",
    fDesign: "Kartendesign gewählt", fNote: "Notiz", fKind: "Besonderheit", fArtist: "Illustrator deiner Karte",
    fRarer: "Seltenere Karte verfügbar", fEmpty: "Noch keine passenden Karten eingetragen.",
    fResults: "Treffer", fResultsCount: "{n} Pokémon auf {p} Seiten", fNoResults: "Kein Pokémon passt zu den Filtern.",
    fHidden: "Dieses Pokémon ist durch die Filter ausgeblendet.",
  },
  en: {
    title: "Pokémon Binder Tracker",
    binder: "Binder", data: "Options", backup: "Backup", storage: "Storage",
    languageHint: "Language of the interface, names and card images.",
    backupHint: "Save or restore your collection and wishlist as a file. Save regularly!",
    stats: "Statistics", backupSave: "Save backup", backupSaveTip: "Save the collection as a file",
    backupLoad: "Load backup", backupLoadTip: "Restore a saved file (JSON backup or CSV)", language: "Language",
    page: "Page", overview: "Overview", show: "Show", all: "all", onlyMissing: "missing only", onlyHave: "owned only",
    searchPh: "Search Pokémon (English, German or number)…", searchLabel: "Search Pokémon",
    prevPage: "Previous page", nextPage: "Next page", close: "Close",
    note: "Note", notePh: "e.g. condition, bought at …", cardLang: "Card language", moreTip: "More for this card", clearSlot: "Clear slot",
    noDesign: "No design", noDesignRarity: "Rarity without design", load: "Load", cancel: "Cancel",
    freeSlot: "free for new Pokémon", free: "free", pickCard: "+ Choose card",
    pageTitle: "Binder {b} · Page {p}", range: "{a} to {b}", inBinder: "{a} / {b} in binder", of: "of {n}",
    cardsKnown: "{n} cards known", noCards: "No cards known. Use “No design”.",
    noRarity: "not specified", reverseTip: "This card as Reverse Holo",
    rarerHint: "Note: {a} was rarer than {b}.", saveFailed: "Online save failed",
    total: "total", byRarity: "By rarity", withDesign: "{a} of {b} cards with a chosen card design.",
    nothingFound: "Nothing found", missingYet: "missing", where: "B{b} · P. {p} · {slot}",
    backupSaved: "Backup saved.", backupNotSaved: "Backup was not saved.",
    csvSave: "Export CSV (Excel)", csvSaveTip: "All Pokémon as a spreadsheet for Excel. Can be loaded again with “Load backup” (without the wishlist).",
    csvSaved: "CSV saved.", csvNotSaved: "CSV was not saved.", yes: "yes", no: "no",
    csvHead: "No|Name (DE)|Name (EN)|Generation|Binder|Page|Row|Column|Owned|Rarity|Tier|Set|Card number|Card name|Language|Upgrade|Value (€)|Note",
    backupAsk: "Load backup with {n} cards? Your current entries will be replaced.",
    backupLoaded: "Backup loaded.", backupInvalid: "This file is not a valid backup.",
    savedLocal: "Saved in this browser", connecting: "Connecting…", liveWait: "Online storage not reachable yet",
    live: "Saved live", liveErr: "Online storage unavailable",
    rows: ["top", "2nd row", "3rd row", "bottom"], cols: ["left", "2nd from left", "3rd from left", "right"],
    wish: "Wishlist", cardList: "Card list", wlHits: "{n} cards", more: "Show more",
    wlSearchPh: "Search cards: Pokémon, card name, set or number …",
    wishAdd: "Add to wishlist", wishRemove: "Remove from wishlist", inBinderTag: "in binder",
    wishEmpty: "No wished cards yet. Tap ★ in the card list.",
    unwish: "Don't want anymore", wishedSince: "wished since {d}",
    allBoosters: "All boosters", boosterLabel: "Choose booster", nextBooster: "Next booster",
    sortLabel: "Sort", sortNew: "Newest first", sortOld: "Oldest first", sortDex: "Pokédex number", sortRarity: "Rarest first",
    shop: "Shopping helper",
    shopHint: "Booster suggestions from your wishlist: sets with the most wished cards first.",
    shopCount: "{n} wished cards", shopOne: "1 wished card",
    shopSingles: "Not sold as boosters (promos, trainer kits …), best bought as singles",
    undoTip: "Undo (Ctrl+Z)", redoTip: "Redo (Ctrl+Y)", undone: "Undone: {x}", redone: "Redone: {x}",
    nothingUndo: "Nothing to undo", nothingRedo: "Nothing to redo",
    wishOp: "Wishlist: {x}", backupStep: "Load backup",
    shopEmpty: "No wished cards yet, so no suggestions. Mark cards with ★ in the card list.",
    collection: "Collection", value: "Value", approx: "approx. {v}", noPrice: "no price known",
    priceLoading: "Loading price…", priceFailed: "Price unavailable",
    valueHint: "Rough value of your entered cards: Cardmarket trend price via TCGdex, regardless of language and condition. Prices are only requested when you press the button.",
    valueButton: "Get binder value", valueLoading: "Loading prices… {a} / {b}",
    valueCount: "{a} of {b} cards with a price.", valueAsOf: "As of {d}.",
    valueNoDesign: "Without a chosen card design and therefore without a price: {n}.",
    valueTop: "The 10 most valuable cards",
    upgrades: "Upgrades", onlyUpgrades: "upgrades only", upTag: "Upgrade wanted", upToggle: "Want to replace",
    upAuto: "Replaced automatically (everything below “{x}”).", upManual: "marked by hand",
    upHint: "Cards you want to replace with a better one: marked by hand (“…” menu on the slot) or with cards on your wishlist. Everything below “{x}” is an upgrade automatically and only gets the ↑ on the slot.",
    upCount: "{n} Pokémon ({m} marked by hand, {w} with wished cards)", upEmpty: "No open upgrades. Mark cards in the “…” menu or add cards to your wishlist.",
    upSortCommon: "Most common first", pricesFailed: "{n} prices could not be loaded.",
    fBtn: "Filter", fReset: "Reset filters", fRemove: "Remove filter", fMatch: "{a} of {b} match",
    fHint: "Several values in one group: any of them is enough. Rarity, series, set, design and note refer to the card you entered.",
    fGen: "Generation", genN: "Gen {n}", fType: "Primary type", fType2: "Secondary type", fNone: "none",
    fTier: "Rarity", fSeries: "Series", fSet: "Set of your card",
    fDesign: "Card design chosen", fNote: "Note", fKind: "Special", fArtist: "Illustrator of your card",
    fRarer: "Rarer card available", fEmpty: "No matching cards entered yet.",
    fResults: "Matches", fResultsCount: "{n} Pokémon on {p} pages", fNoResults: "No Pokémon matches the filters.",
    fHidden: "This Pokémon is hidden by the filters.",
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
  $$("[data-i18n]").forEach(el => (el.textContent = t(el.dataset.i18n)));
  $$("[data-i18n-ph]").forEach(el => (el.placeholder = t(el.dataset.i18nPh)));
  $$("[data-i18n-tip]").forEach(el => {
    el.title = t(el.dataset.i18nTip);
    if (!/\w/.test(el.textContent)) el.setAttribute("aria-label", t(el.dataset.i18nTip));  // nur ohne sichtbaren Text
  });
}

function setLang(id) {
  storageSet(LANG_KEY, id);
  location.reload();  // Namen und Kartenlisten neu aufbauen
}
