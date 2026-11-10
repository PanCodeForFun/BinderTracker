// Kleine Helfer, die alle anderen Dateien nutzen: DOM, Text, Listen, Speicher, Dateien.

// ---------- DOM ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const on = (target, type, fn, opts) => (typeof target === "string" ? $(target) : target).addEventListener(type, fn, opts);
// Ein Listener am Container für alle passenden Kinder, auch für später gezeichnete.
const onClosest = (sel, type, child, fn) => on(sel, type, e => { const el = e.target.closest(child); if (el) fn(el, e); });
// Klick auf jedes Element der Auswahl: fn(element).
const onEach = (sel, fn) => $$(sel).forEach(el => on(el, "click", () => fn(el)));
// Reiter und Umschalter: Klasse "on" für das Element, dessen data-<key> zu value passt.
const markOn = (sel, key, value) => $$(sel).forEach(el => el.classList.toggle("on", el.dataset[key] === String(value)));
// <option>-Liste aus [Wert, Text] (optional [Wert, Text, gesperrt]).
const optionsHtml = (items, selected) => items.map(([value, label, disabled]) =>
  `<option value="${esc(value)}"${value === selected ? " selected" : ""}${disabled ? " disabled" : ""}>${esc(label)}</option>`).join("");

// ---------- Zahlen und Listen ----------
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const range = (count, start = 0) => Array.from({ length: count }, (_, i) => start + i);
const countBy = (items, key) => items.reduce((acc, x) => ((acc[key(x)] = (acc[key(x)] || 0) + 1), acc), {});
const groupBy = (items, key) => items.reduce((map, x) => map.set(key(x), [...(map.get(key(x)) || []), x]), new Map());
const today = () => new Date().toISOString().slice(0, 10);

// fn für alle items, höchstens workers gleichzeitig.
async function runPool(items, workers, fn) {
  const queue = [...items];
  const worker = async () => { for (let x; (x = queue.shift()); ) await fn(x); };
  await Promise.all(range(workers).map(worker));
}

// ---------- Browser-Speicher (Fehler wie privater Modus oder voller Speicher werden ignoriert) ----------
const storageGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
const storageSet = (key, text) => { try { localStorage.setItem(key, text); } catch { /* privater Modus o. ä. */ } };
const readJson = (key, fallback) => { try { return JSON.parse(storageGet(key)) ?? fallback; } catch { return fallback; } };
const writeJson = (key, value) => storageSet(key, JSON.stringify(value));

// ---------- Online-Speicher (nur auf claude.ai, sonst null) ----------
let liveDbPromise = null;
const liveDb = () => (liveDbPromise ??= Promise.resolve().then(() => window.claude?.use?.("db")).then(db => db || null, () => null));

// Eine Sammlung von Dokumenten im Online-Speicher. Ohne Verbindung tut write nichts.
class LiveDocs {
  constructor(name) { this.name = name; this.db = null; }

  // Verbindet. false, wenn es keinen Online-Speicher gibt.
  async connect() {
    this.db = await liveDb();
    return !!this.db;
  }

  // Meldet jeden Stand über onSnap(snap). Bei einem Fehler wird die Verbindung getrennt.
  watch(onSnap, onError = () => {}) {
    this.db?.collection(this.name).onSnapshot(onSnap, () => { this.db = null; onError(); });
  }

  // Dokument setzen (data) oder löschen (null).
  async write(id, data) {
    if (!this.db) return;
    const ref = this.db.collection(this.name).doc(id);
    await (data ? ref.set(data) : ref.delete());
  }
}

// ---------- Dateien ----------
// Speichert eine Datei: auf claude.ai über "downloads", sonst als normaler Download.
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
