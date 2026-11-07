// Die Sammlung: { "6": { r: "fullart", card: "sv3-215", note: "" } }
// Immer im Browser gespeichert, auf claude.ai zusätzlich online.

let collection = {};
let liveDb = null;

function cleanEntry(n, v) {
  if (!BY_N.has(+n) || !RARITY[v?.r]) return null;
  return { r: v.r, card: typeof v.card === "string" ? v.card : "", note: String(v.note || "") };
}
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
const backupJson = () => JSON.stringify({ app: "pokebinder", version: 2, saved: new Date().toISOString(), collection }, null, 1);

function parseBackup(text) {
  const c = JSON.parse(text)?.collection;
  if (!c || typeof c !== "object") throw new Error("kein Backup");
  return cleanAll(Object.entries(c));
}

async function saveFile(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  if (window.claude?.use) {
    const dl = await window.claude.use("downloads");
    if (!dl) throw new Error("unavailable");
    return dl.save({ filename, data: blob });
  }
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
