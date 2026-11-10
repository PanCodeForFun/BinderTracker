// Backup der Sammlung: JSON (vollständig, mit Wunschliste) und CSV für Excel.
// Beides lässt sich über „Backup laden“ wieder einlesen (parseBackup).

// ---------- JSON ----------
// Version 3: mit Wunschliste. Ältere Backups haben keine, dann ist wishlist null.
const backupJson = () =>
  JSON.stringify({ app: "pokebinder", version: 3, saved: new Date().toISOString(), collection, wishlist: wishEntries() }, null, 1);

// JSON-Backup oder CSV (aus backupCsv, auch nach Bearbeitung in Excel). Die CSV enthält keine Wunschliste.
function parseBackup(text) {
  text = text.replace(/^﻿/, "");
  if (!text.trimStart().startsWith("{")) return { collection: parseCsv(text), wishlist: null };
  const data = JSON.parse(text);
  if (!data?.collection || typeof data.collection !== "object") throw new Error("kein Backup");
  return { collection: cleanAll(Object.entries(data.collection)), wishlist: Array.isArray(data.wishlist) ? data.wishlist : null };
}

// ---------- CSV ----------
// Spalten der CSV. Überschriften stehen in i18n.js (csvHead), in derselben Reihenfolge.
// Eine Zeile pro Pokémon, auch fehlende (Filter „Vorhanden = nein“ = Fehlliste).
const CSV_COLUMNS = [
  ({ p }) => p.n, ({ p }) => p.de, ({ p }) => p.en, ({ p }) => p.gen,
  ({ loc }) => loc.binder, ({ loc }) => loc.page, ({ loc }) => loc.row, ({ loc }) => loc.col,
  ({ e }) => t(e ? "yes" : "no"), ({ r }) => r?.label, ({ r }) => r && TIER[r.tier].label,
  ({ card }) => card?.set, ({ card }) => card?.num, ({ card }) => card?.name,
  ({ e }) => e && CARD_LANG[cardLang(e)].short, ({ e }) => e && t(wantsUpgrade(e) ? "yes" : "no"),
  ({ e, card }) => csvNumber(cardValue(card, e?.r === "reverse")), ({ e }) => e?.note,
];
// Spalten, die parseCsv immer an derselben Stelle erwartet (ältere CSVs haben weniger Spalten).
const CSV_COL = { n: 0, owned: 8, rarity: 9, set: 11, num: 12, note: 15 };

const csvNumber = v => (v == null ? "" : LANG === "de" ? v.toFixed(2).replace(".", ",") : v.toFixed(2));
function csvCell(v) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;  // keine Formeln in Excel
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Semikolon und BOM, damit deutsches Excel Spalten und Umlaute richtig erkennt.
function backupCsv() {
  const rows = DEX.map(p => {
    const e = collection[p.n];
    const row = { p, e, r: e && RARITY[e.r], card: e && findCard(p.n, e.card), loc: locate(p.n) };
    return CSV_COLUMNS.map(col => col(row));
  });
  return "﻿" + [t("csvHead").split("|"), ...rows].map(r => r.map(csvCell).join(";")).join("\r\n");
}

// Zerlegt CSV mit ; , oder Tab (Excel speichert je nach Land anders), Anführungszeichen wie in RFC 4180.
function csvRows(text) {
  const sep = [";", ",", "\t"].find(c => text.split(/\r?\n/)[0].includes(c)) || ";";
  const rows = [[""]];
  for (let i = 0, quoted = false; i < text.length; i++) {
    const c = text[i], row = rows[rows.length - 1];
    if (quoted) {
      if (c !== '"') row[row.length - 1] += c;
      else if (text[i + 1] === '"') { row[row.length - 1] += c; i++; }
      else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === sep) row.push("");
    else if (c === "\n") rows.push([""]);
    else if (c !== "\r") row[row.length - 1] += c;
  }
  return rows.filter(r => r.some(Boolean));
}

// Liest eine CSV aus backupCsv zurück. Sprache, Upgrade und Notiz werden über die Überschrift
// gefunden (ältere CSVs haben sie nicht alle), Set und Kartennummer bestimmen das Kartendesign.
function parseCsv(text) {
  const [head, ...rows] = csvRows(text);
  if (!/^(nr|no)$/i.test(head?.[CSV_COL.n]?.trim())) throw new Error("keine Binder-CSV");
  const yes = s => /^(ja|yes|y|x|1|true|wahr)$/i.test(s?.trim());
  const low = s => (s || "").trim().toLowerCase();
  const col = (re, fallback) => { const i = head.findIndex(h => re.test(h.trim())); return i >= 0 ? i : fallback; };
  const langCol = col(/^(sprache|language)$/i, -1), upCol = col(/^upgrade$/i, -1), noteCol = col(/^(notiz|note)$/i, CSV_COL.note);

  const entries = rows.filter(r => yes(r[CSV_COL.owned])).map(r => {
    const n = parseInt(r[CSV_COL.n], 10);
    const card = findCardByPrint(n, r[CSV_COL.set], r[CSV_COL.num]);
    const rarity = RARITIES.find(x => low(x.label) === low(r[CSV_COL.rarity]) || x.id === low(r[CSV_COL.rarity]))?.id;
    const lang = CARD_LANGS.find(l => [l.id, l.short, l.label].some(x => low(x) === low(r[langCol])))?.id;
    const note = (r[noteCol] || "").replace(/^'(?=[=+\-@\t\r])/, "");  // Schutz-Apostroph aus dem Export
    return [n, { r: rarity || card?.cat || "normal", card: card?.id || "", note, lang, up: upCol >= 0 && yes(r[upCol]) }];
  });
  return cleanAll(entries);
}
