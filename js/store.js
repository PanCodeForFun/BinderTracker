// Die Sammlung: { "6": { r: "fullart", card: "sv3-215", note: "", lang: "ja" } }
// lang (Sprache der Karte) fehlt bei deutschen Karten.
// up: true = Upgrade gesucht, nur gespeichert ab Stufe UPGRADE_BELOW (darunter gilt es automatisch).
// Immer im Browser gespeichert, auf claude.ai zusätzlich online.

let collection = {};
let liveDb = null;

// Upgrade gesucht? Unter UPGRADE_BELOW immer, darüber nur mit Haken.
const autoUpgrade = e => RARITY[e.r].tierRank < TIER[UPGRADE_BELOW].rank;
const wantsUpgrade = e => !!e && (autoUpgrade(e) || e.up === true);

function cleanEntry(n, v) {
  if (!BY_N.has(+n) || !RARITY[v?.r]) return null;
  const e = { r: v.r, card: typeof v.card === "string" ? v.card : "", note: String(v.note || "") };
  if (CARD_LANG[v.lang] && v.lang !== DEFAULT_CARD_LANG) e.lang = v.lang;
  if (v.up === true && !autoUpgrade(e)) e.up = true;
  return e;
}
const cardLang = e => e?.lang || DEFAULT_CARD_LANG;
function cleanAll(entries) {
  const out = {};
  for (const [n, v] of entries) {
    const e = cleanEntry(n, v);
    if (e) out[n] = e;
  }
  return out;
}

function saveLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collection)); } catch { /* privater Modus o. ä. */ }
}
function loadLocal() {
  try { collection = cleanAll(Object.entries(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {})); } catch { collection = {}; }
}

// Eintrag setzen (entry) oder löschen (null).
async function saveEntry(n, entry) {
  track("slot", n, collection[n], entry || undefined);  // für Rückgängig (history.js)
  if (entry) collection[n] = entry; else delete collection[n];
  saveLocal();
  if (!liveDb) return;
  const ref = liveDb.collection(DB_COLLECTION).doc(String(n));
  await (entry ? ref.set(entry) : ref.delete());
}

async function replaceCollection(next) {
  const ids = new Set([...Object.keys(collection), ...Object.keys(next)]);
  for (const n of ids) await saveEntry(+n, next[n] || null);
}

const owned = n => collection[n];
const ownedCount = predicate => DEX.filter(p => collection[p.n] && predicate(p)).length;

// Verbindet den Online-Speicher, falls die Seite auf claude.ai läuft.
// onStatus(kind, text), onChange() bei jeder Änderung von außen.
async function connectLive(onStatus, onChange) {
  const db = await window.claude?.use?.("db");
  if (!db) return onStatus("local", t("savedLocal"));
  liveDb = db;
  onStatus("wait", t("connecting"));
  const timer = setTimeout(() => onStatus("wait", t("liveWait")), 10000);
  db.collection(DB_COLLECTION).onSnapshot(snap => {
    collection = cleanAll(snap.docs.map(d => [d.id, d.data()]));
    saveLocal();
    if (!snap.metadata.fromCache) { clearTimeout(timer); onStatus("live", t("live")); }
    onChange();
  }, () => {
    clearTimeout(timer);
    liveDb = null;
    onStatus("err", t("liveErr"));
  });
}

// ---------- Backup ----------
// Version 3: mit Wunschliste (js/wishlist.js). Ältere Backups haben keine, dann ist wishlist null.
const backupJson = () =>
  JSON.stringify({ app: "pokebinder", version: 3, saved: new Date().toISOString(), collection, wishlist: wishEntries() }, null, 1);

// JSON-Backup oder CSV (aus backupCsv, auch nach Bearbeitung in Excel). Die CSV enthält keine Wunschliste.
function parseBackup(text) {
  text = text.replace(/^\uFEFF/, "");
  if (!text.trimStart().startsWith("{")) return { collection: parseCsv(text), wishlist: null };
  const data = JSON.parse(text);
  if (!data?.collection || typeof data.collection !== "object") throw new Error("kein Backup");
  return { collection: cleanAll(Object.entries(data.collection)), wishlist: Array.isArray(data.wishlist) ? data.wishlist : null };
}

// CSV für Excel: eine Zeile pro Pokémon, auch fehlende (Filter „Vorhanden = nein“ = Fehlliste).
// Semikolon und BOM, damit deutsches Excel Spalten und Umlaute richtig erkennt. Einlesen: parseCsv.
function backupCsv() {
  const cell = v => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;  // keine Formeln in Excel
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const num = v => (v == null ? "" : LANG === "de" ? v.toFixed(2).replace(".", ",") : v.toFixed(2));
  const rows = DEX.map((p, i) => {
    const e = collection[p.n], r = e && RARITY[e.r], card = e && findCard(p.n, e.card);
    const { binder, page, row, col } = locate(p.n);
    return [p.n, p.de, p.en, POKEDEX[i][3], binder, page, row, col, t(e ? "yes" : "no"),
      r?.label, r && TIER[r.tier].label, card?.set, card?.num, card?.name, e && CARD_LANG[cardLang(e)].short, e && t(wantsUpgrade(e) ? "yes" : "no"), num(cardValue(card, e?.r === "reverse")), e?.note];
  });
  return "\uFEFF" + [t("csvHead").split("|"), ...rows].map(r => r.map(cell).join(";")).join("\r\n");
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

// Spalten wie in backupCsv: 0 Nr, 8 Vorhanden, 9 Seltenheit, 11 Set, 12 Kartennummer, dann Sprache und Notiz.
// Sprache, Upgrade und Notiz werden über die Überschrift gefunden (ältere CSVs haben sie nicht alle).
function parseCsv(text) {
  const [head, ...rows] = csvRows(text);
  if (!/^(nr|no)$/i.test(head?.[0]?.trim())) throw new Error("keine Binder-CSV");
  const yes = /^(ja|yes|y|x|1|true|wahr)$/i;
  const low = s => (s || "").trim().toLowerCase();
  const col = (re, fallback) => { const i = head.findIndex(h => re.test(h.trim())); return i >= 0 ? i : fallback; };
  const langCol = col(/^(sprache|language)$/i, -1), upCol = col(/^upgrade$/i, -1), noteCol = col(/^(notiz|note)$/i, 15);
  const entries = rows.filter(r => yes.test(r[8]?.trim())).map(r => {
    const n = parseInt(r[0], 10), set = low(r[11]), num = low(r[12]);
    const card = set && num && (TCG_CARDS[n] || []).find(([i, cardNum]) =>
      cardNum.toLowerCase() === num && [TCG_SETS[i][1], TCG_SETS[i][5]].some(name => low(name) === set));
    const rarity = RARITIES.find(x => low(x.label) === low(r[9]) || x.id === low(r[9]))?.id;
    const lang = CARD_LANGS.find(l => [l.id, l.short, l.label].some(x => low(x) === low(r[langCol])))?.id;
    const note = (r[noteCol] || "").replace(/^'(?=[=+\-@\t\r])/, "");  // Schutz-Apostroph aus dem Export
    return [n, { r: rarity || card?.[2] || "normal", card: card ? `${TCG_SETS[card[0]][0]}-${card[1]}` : "", note, lang, up: upCol >= 0 && yes.test(r[upCol]?.trim()) }];
  });
  return cleanAll(entries);
}

async function saveFile(filename, text, type = "application/json") {
  const blob = new Blob([text], { type });
  if (window.claude?.use) {
    const dl = await window.claude.use("downloads");
    if (!dl) throw new Error("unavailable");
    return dl.save({ filename, data: blob });
  }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
