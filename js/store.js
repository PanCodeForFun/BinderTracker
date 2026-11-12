// Die Daten der App: Sammlung und Wunschliste. Beide liegen immer im Browser, auf claude.ai
// zusätzlich online. Jede Änderung läuft über saveEntry bzw. setWish und landet damit
// auch im Verlauf für Rückgängig (js/history.js).

// ---------- Sammlung ----------
// { "6": { r: "fullart", card: "sv3-215", note: "", lang: "ja", up: true } }
// lang (Sprache der Karte) fehlt bei deutschen Karten.
// up: true = Upgrade gesucht, nur gespeichert ab Stufe UPGRADE_BELOW (darunter gilt es automatisch).
let collection = {};
const collectionDocs = new LiveDocs(DB_COLLECTION);

const owned = n => collection[n];
const ownedCount = predicate => SLOTS.filter(p => collection[p.n] && predicate(p)).length;
// Einträge aller Slots (ohne ungültige Nummern).
const activeEntries = () => SLOTS.map(p => collection[p.n]).filter(Boolean);
// Eingetragene Karten mit gewähltem Design: { n, e (Eintrag), c (Karte) }.
const ownedCards = () => Object.entries(collection)
  .filter(([n]) => BY_N.has(+n))
  .map(([n, e]) => ({ n: +n, e, c: findCard(+n, e.card) }))
  .filter(x => x.c);
const cardLang = e => e?.lang || DEFAULT_CARD_LANG;

// Upgrade gesucht? Unter UPGRADE_BELOW immer, darüber nur mit Haken.
const autoUpgrade = e => RARITY[e.r].tierRank < TIER[UPGRADE_BELOW].rank;
const wantsUpgrade = e => !!e && (autoUpgrade(e) || e.up === true);

// Prüft einen Eintrag (z. B. aus einem Backup) und behält nur bekannte Felder. Ungültig: null.
function cleanEntry(n, v) {
  if (!BY_N.has(+n) || !RARITY[v?.r]) return null;
  const e = { r: v.r, card: typeof v.card === "string" ? v.card : "", note: String(v.note || "") };
  if (CARD_LANG[v.lang] && v.lang !== DEFAULT_CARD_LANG) e.lang = v.lang;
  if (v.up === true && !autoUpgrade(e)) e.up = true;
  return e;
}
// [[n, Eintrag], …] -> { n: Eintrag } ohne ungültige Einträge
function cleanAll(entries) {
  const out = {};
  for (const [n, v] of entries) {
    const e = cleanEntry(n, v);
    if (e) out[n] = e;
  }
  return out;
}

const saveCollectionLocal = () => writeJson(STORAGE_KEY, collection);
function loadCollection() {
  try { collection = cleanAll(Object.entries(readJson(STORAGE_KEY, {}))); } catch { collection = {}; }
}

// Eintrag setzen (entry) oder löschen (null).
async function saveEntry(n, entry) {
  track("slot", n, collection[n], entry || undefined);
  if (entry) collection[n] = entry; else delete collection[n];
  saveCollectionLocal();
  await collectionDocs.write(String(n), entry);
}

async function replaceCollection(next) {
  const ids = new Set([...Object.keys(collection), ...Object.keys(next)]);
  for (const n of ids) await saveEntry(+n, next[n] || null);
}

// ---------- Wunschliste ----------
// Karten-id -> Zeitpunkt des Wünschens (ms, 0 = unbekannt). Im Browser als [[id, Zeitpunkt], …].
let wishlist = new Map();
const wishDocs = new LiveDocs(DB_WISH);

const isWished = id => wishlist.has(id);
const wishEntries = () => [...wishlist].map(([id, at]) => ({ id, t: at }));

// Nimmt alte Listen (nur ids) und neue ([id, t] oder {id, t}) an.
function cleanWish(raw) {
  const out = new Map();
  for (const x of Array.isArray(raw) ? raw : []) {
    const [id, at] = typeof x === "string" ? [x, 0] : Array.isArray(x) ? x : [x?.id, x?.t];
    if (typeof id === "string" && id) out.set(id, Number(at) || 0);
  }
  return out;
}

const saveWishLocal = () => writeJson(WISH_KEY, [...wishlist]);
const loadWishlist = () => { wishlist = cleanWish(readJson(WISH_KEY, [])); };

async function setWish(id, wanted, at = Date.now()) {
  track("wish", id, wishlist.get(id), wanted ? wishlist.get(id) ?? at : undefined);
  if (wanted) wishlist.set(id, wishlist.get(id) || at); else wishlist.delete(id);
  saveWishLocal();
  await wishDocs.write(encodeURIComponent(id), wanted && { id, t: wishlist.get(id) });
}

async function replaceWishlist(raw) {
  const next = cleanWish(raw);
  for (const id of [...wishlist.keys()]) if (!next.has(id)) await setWish(id, false);
  for (const [id, at] of next) { wishlist.delete(id); await setWish(id, true, at); }
}

// ---------- Online-Speicher (nur claude.ai) ----------
// onStatus(kind, text) für die Statusanzeige, onCollection() / onWishlist() bei Änderungen von außen.
async function connectLive({ onStatus, onCollection, onWishlist }) {
  if (!(await collectionDocs.connect())) return onStatus("local", t("savedLocal"));
  onStatus("wait", t("connecting"));
  const timer = setTimeout(() => onStatus("wait", t("liveWait")), 10000);
  collectionDocs.watch(snap => {
    collection = cleanAll(snap.docs.map(d => [d.id, d.data()]));
    saveCollectionLocal();
    if (!snap.metadata.fromCache) { clearTimeout(timer); onStatus("live", t("live")); }
    onCollection();
  }, () => {
    clearTimeout(timer);
    onStatus("err", t("liveErr"));
  });

  if (!(await wishDocs.connect())) return;
  wishDocs.watch(snap => {
    wishlist = cleanWish(snap.docs.map(d => d.data()));
    saveWishLocal();
    onWishlist();
  });
}
