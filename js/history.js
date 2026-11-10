// Rückgängig / Wiederholen für Sammlung und Wunschliste (Strg+Z, Strg+Y, Buttons oben).
// Ein Schritt ist eine Liste von Änderungen { kind: "slot" | "wish", key, before, after }.
// saveEntry und setWish (js/store.js) melden jede Änderung über track().
// Der Verlauf gilt nur für die aktuelle Sitzung.

const HISTORY_MAX = 100;
const hist = { past: [], future: [], step: null, replaying: false };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Wie eine Änderung je Art wieder angewendet wird (value = before oder after).
const HISTORY_APPLY = {
  slot: (key, value) => saveEntry(+key, value || null),
  wish: (key, value) => setWish(key, value !== undefined, value),
};

// Mehrere Änderungen zu einem Schritt bündeln (z. B. Karte setzen + Wunsch entfernen, Backup laden).
// fn darf async sein, dann endet der Schritt, wenn fn fertig ist.
function asStep(label, fn) {
  if (hist.step) return fn();  // schon in einem Schritt
  const step = (hist.step = { label, ops: [] });
  const end = () => { hist.step = null; if (step.ops.length) pushStep(step); };
  let result;
  try { result = fn(); } catch (err) { end(); throw err; }
  if (result?.then) return result.finally(end);
  end();
  return result;
}

function track(kind, key, before, after) {
  if (hist.replaying || same(before, after)) return;
  const op = { kind, key: String(key), before, after };
  if (hist.step) hist.step.ops.push(op);
  else pushStep({ label: "", ops: [op] });
}

function pushStep(step) {
  hist.past.push(step);
  if (hist.past.length > HISTORY_MAX) hist.past.shift();
  hist.future = [];
  updateHistoryButtons();
}

// Ein Schritt zurück (dir = -1) oder vor (dir = +1). Ändert die Daten sofort und gibt
// { step, done } zurück (done: Promise fürs Online-Speichern), oder null, wenn nichts da ist.
function stepHistory(dir) {
  const [from, to] = dir < 0 ? [hist.past, hist.future] : [hist.future, hist.past];
  const step = from.pop();
  if (!step) return null;
  to.push(step);
  updateHistoryButtons();
  const ops = dir < 0 ? [...step.ops].reverse() : step.ops;
  hist.replaying = true;
  const jobs = ops.map(o => HISTORY_APPLY[o.kind](o.key, dir < 0 ? o.before : o.after));
  hist.replaying = false;
  return { step, done: Promise.all(jobs) };
}

// Text für den Hinweis, z. B. "006 Glurak" oder "Wunschliste: Glurak ex".
function stepLabel(step) {
  if (step.label) return step.label;
  const o = step.ops.find(x => x.kind === "slot") || step.ops[0];
  return o.kind === "slot" ? `${pad(+o.key)} ${BY_N.get(+o.key)?.name || ""}` : t("wishOp", { x: cardById(o.key)?.name || o.key });
}

function updateHistoryButtons() {
  $("#btnUndo").disabled = !hist.past.length;
  $("#btnRedo").disabled = !hist.future.length;
}
