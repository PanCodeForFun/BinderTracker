// Start der App: Bereiche umschalten, Adresse (#…), Rückgängig, Tastatur.

// Die Bereiche und Ansichten. hash: Endung der Adresse, z. B. #b1-s3-ue für die Übersicht.
const VIEWS = {
  page:     { el: "#pageView",  hash: "",    render: renderPage },
  overview: { el: "#overView",  hash: "-ue", render: renderOverview },
  wish:     { el: "#wishView",  hash: "-wl", render: renderWishView },
  stats:    { el: "#statsView", hash: "-st", render: renderCollection },
  data:     { el: "#dataView",  hash: "-da", render: () => {} },
};
const isBinderMode = mode => mode === "page" || mode === "overview";

// Zeichnet den aktuellen Bereich neu (nach jeder Änderung an Daten oder Ansicht).
function render() {
  closeSlotMenu();
  renderBinderBar();
  const binder = isBinderMode(view.mode);
  if (binder) view.binderMode = view.mode;  // beim Zurückwechseln wieder Seite bzw. Übersicht
  $$(".sect").forEach(b => b.classList.toggle("on", b.dataset.mode === view.mode || (binder && b.dataset.mode === "page")));
  $("#binderBar").hidden = $("#binderSearch").hidden = !binder;
  for (const [mode, v] of Object.entries(VIEWS)) $(v.el).hidden = mode !== view.mode;
  VIEWS[view.mode].render();
  if (pick.n) renderPicker();
  writeHash();
}

// Oberer Bereichs-Knopf. „Binder“ kehrt zur zuletzt genutzten Binderansicht zurück.
function openSection(mode) {
  if (mode !== "page") view.mode = mode;
  else if (!isBinderMode(view.mode)) view.mode = view.binderMode || "page";
  render();
  scrollTo({ top: 0 });
}

// ---------- Adresse: #b<Binder>-s<Seite><Endung> ----------
function readHash() {
  const m = location.hash.match(/^#b([12])-s(\d+)(-\w\w)?$/);
  const mode = m && Object.keys(VIEWS).find(k => VIEWS[k].hash === (m[3] || ""));
  if (mode) Object.assign(view, { binder: +m[1], page: +m[2], mode });
}
function writeHash() {
  const h = `#b${view.binder}-s${view.page}${VIEWS[view.mode].hash}`;
  if (location.hash !== h) try { history.replaceState(null, "", h); } catch { /* egal */ }
}

// ---------- Rückgängig / Wiederholen (js/history.js) ----------
async function undoRedo(dir) {
  const res = stepHistory(dir);
  if (!res) return toast(t(dir < 0 ? "nothingUndo" : "nothingRedo"));
  const s = res.step;
  if (closeZoom() || pick.n) closePicker();
  // Einzelner Slot auf einer anderen Binderseite: dorthin blättern
  const o = s.ops.length === 1 && s.ops[0].kind === "slot" ? s.ops[0] : null;
  if (o && view.mode === "page" && !slotEl(o.key)) goTo(+o.key); else render();
  if (o && view.mode === "page") slotEl(o.key)?.classList.add("flash");
  toast(t(dir < 0 ? "undone" : "redone", { x: stepLabel(s) }));
  await saved(res.done);
}

// ---------- Tastatur ----------
function onKey(e) {
  const key = e.key.toLowerCase();
  // Strg+Z / Strg+Y / Strg+Umschalt+Z (Mac: Cmd); in Textfeldern bleibt es beim Text-Rückgängig
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (key === "z" || key === "y") && !e.target.matches("input, textarea")) {
    e.preventDefault();
    return undoRedo(key === "y" || e.shiftKey ? 1 : -1);
  }
  if (e.key === "Escape") return closeSlotMenu() || closeZoom() || closePicker();
  if (e.target.matches("input, select") || document.body.classList.contains("modal-open") || view.mode !== "page") return;
  if (e.key === "ArrowLeft") turnPage(-1);
  if (e.key === "ArrowRight") turnPage(1);
  if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
}

function bindMainEvents() {
  onEach(".sect", b => openSection(b.dataset.mode));
  on("#btnUndo", "click", () => undoRedo(-1));
  on("#btnRedo", "click", () => undoRedo(1));
  on("#zoom", "click", e => { if (!e.target.closest("img")) closeZoom(); });
  on(window, "popstate", () => closeZoom(true));
  on(window, "hashchange", () => { readHash(); render(); });
  on(document, "keydown", onKey);
}

// ---------- Start ----------
applyStaticText();
loadCollection();
loadWishlist();
readHash();
[bindMainEvents, bindBinderEvents, bindPickerEvents, bindCollectionEvents, bindWishEvents, bindSearchEvents, bindOptionEvents].forEach(bind => bind());
render();
connectLive({
  onStatus: setStatus,
  onCollection: render,
  onWishlist: () => view.mode === "wish" && renderWishView(),
});
