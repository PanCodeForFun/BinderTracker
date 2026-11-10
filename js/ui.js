// Oberfläche: Binderseite, Übersicht, Kartenauswahl, Sammlung (Statistik, Wert), Suche.

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const countBy = (items, key) => items.reduce((acc, x) => ((acc[key(x)] = (acc[key(x)] || 0) + 1), acc), {});
const colorStyle = r => (r ? `style="--r:${r.color};--rInk:${r.ink}"` : "");

const view = { binder: 1, page: 1, mode: "page", filter: "all" };

// ---------- Kleine Bausteine ----------
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2800);
}

function setStatus(kind, text) {
  $("#status").className = "status " + kind;
  $("#status").textContent = text;
  $("#statusText").textContent = text;
}

function openModal(id) {
  $(id).hidden = false;
  $("#modalBack").hidden = false;
  document.body.classList.add("modal-open");
}
function closeModals() {
  document.querySelectorAll(".modal").forEach(m => (m.hidden = true));
  $("#modalBack").hidden = true;
  document.body.classList.remove("modal-open");
  pick.n = null;
}

function askConfirm(msg, onYes) {
  $("#confirmText").textContent = msg;
  $("#confirm").hidden = false;
  $("#confirmYes").onclick = () => { $("#confirm").hidden = true; onYes(); };
  $("#confirmNo").onclick = () => ($("#confirm").hidden = true);
}

// Kartenbild: Quellen aus card.srcs der Reihe nach (siehe imageSources), sonst eine Textkarte.
function cardImage(card, extra = "") {
  const [src, ...rest] = card.srcs;
  return `<div class="cardbox">
    <img src="${esc(src)}" data-fallback="${esc(rest.join("|"))}" alt="${esc(card.name)}" loading="lazy" onerror="cardImageFailed(this)">
    <div class="textcard">${extra}<b>${esc(card.set)}</b><span>${esc(card.num)}/${esc(card.total)}</span></div>
  </div>`;
}

// Bild mit Ersatzquellen (z. B. Set-Logos): srcs der Reihe nach, sonst verschwindet es.
function imgChain(srcs, attrs = "") {
  const [src, ...rest] = srcs;
  return `<img src="${esc(src)}" data-fallback="${esc(rest.join("|"))}" ${attrs} loading="lazy" onerror="cardImageFailed(this)">`;
}

// ---------- Vollansicht einer Karte (×, Escape, Zurück oder Klick daneben schließt) ----------
function openZoom(card) {
  if (!card) return;
  $("#zoomBox").innerHTML = imgChain([...card.big, ...card.srcs], `alt="${esc(card.name)}"`) +
    `<figcaption><b>${esc(card.name)}</b> · ${esc(card.set)} · ${esc(card.num)}/${esc(card.total)} · <span id="zoomPrice"></span></figcaption>`;
  $("#zoomBox img").loading = "eager";
  showPrice($("#zoomPrice"), card);
  $("#zoom").hidden = false;
  document.body.classList.add("modal-open");
  history.pushState({ zoom: true }, "");
}
function closeZoom(viaHistory = false) {
  if ($("#zoom").hidden) return false;
  $("#zoom").hidden = true;
  document.body.classList.remove("modal-open");
  if (!viaHistory && history.state?.zoom) history.back();
  return true;
}
addEventListener("popstate", () => closeZoom(true));

function cardImageFailed(img) {
  if (img.dataset.fallback) {
    const [next, ...rest] = img.dataset.fallback.split("|");
    img.dataset.fallback = rest.join("|");
    img.src = next;
  } else {
    img.parentNode.classList.add("noimg");
    img.remove();
  }
}

function progressTile(label, have, total) {
  return `<div class="stat"><div class="big">${have} / ${total}</div><div class="lbl">${label} (${pct(have, total)} %)</div>
    <div class="progress"><span style="width:${pct(have, total)}%"></span></div></div>`;
}

// ---------- Binderseite ----------
function slotHtml(n) {
  const p = BY_N.get(n), loc = locate(n);
  const corner = `<span class="pos">${loc.row}/${loc.col}</span><span class="num">${pad(n)}</span>`;
  if (!p) return `<div class="slot future">${corner}<div class="free">${t("freeSlot")}</div></div>`;

  const e = owned(n), r = e && RARITY[e.r], card = e && findCard(n, e.card);
  const dim = (view.filter === "missing" && e) || (view.filter === "have" && !e);
  const visual = card
    ? cardImage(card, `<img class="spr" src="${spriteUrl(n)}" alt="">`)
    : `<img class="spr" src="${spriteUrl(n)}" alt="">`;
  const sub = card ? `${card.set} · ${card.num}` : p.alt !== p.name ? p.alt : "";

  return `<div class="slot${e ? " have" : ""}${dim ? " dim" : ""}" data-n="${n}" ${colorStyle(r)}>
    ${corner}
    <div class="vis">${visual}</div>
    <div class="de">${esc(p.name)}</div>
    <div class="sub">${esc(sub) || "&nbsp;"}</div>
    <button class="rbtn">${r ? esc(r.label) : t("pickCard")}</button>
  </div>`;
}

function renderPage() {
  const start = firstOnPage(view.binder, view.page);
  const numbers = Array.from({ length: LAYOUT.slotsPerPage }, (_, i) => start + i);
  $("#pageTitle").textContent = t("pageTitle", { b: view.binder, p: view.page });
  $("#pageRange").textContent = t("range", { a: pad(start), b: pad(Math.min(start + LAYOUT.slotsPerPage - 1, Math.max(start, MAX_N))) });
  $("#pageProgress").textContent =
    t("inBinder", { a: ownedCount(p => inBinder(view.binder, p.n)), b: DEX.filter(p => inBinder(view.binder, p.n)).length });
  $("#grid").innerHTML = numbers.map(slotHtml).join("");
}

function renderOverview() {
  let html = "";
  for (let page = 1; page <= pageCount(view.binder); page++) {
    const start = firstOnPage(view.binder, page);
    const numbers = Array.from({ length: LAYOUT.slotsPerPage }, (_, i) => start + i);
    const cells = numbers.map(n => {
      const p = BY_N.get(n), r = RARITY[owned(n)?.r];
      return `<span class="${!p ? "void" : r ? "have" : ""}" ${colorStyle(r)} title="${p ? esc(pad(n) + " " + p.name) : t("free")}"></span>`;
    });
    const have = numbers.filter(owned).length, real = numbers.filter(n => BY_N.has(n)).length;
    html += `<button class="mini" data-page="${page}"><div class="t"><b>${t("page")} ${page}</b><span>${have}/${real}</span></div><div class="g">${cells.join("")}</div></button>`;
  }
  $("#overView").innerHTML = html;
}

function render() {
  const pages = pageCount(view.binder);
  view.page = Math.min(Math.max(1, view.page), pages);
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", +b.dataset.binder === view.binder));
  const binder = view.mode === "page" || view.mode === "overview";
  if (binder) view.binderMode = view.mode;  // beim Zurückwechseln wieder Seite bzw. Übersicht
  document.querySelectorAll(".sect").forEach(b => b.classList.toggle("on", b.dataset.mode === view.mode || (binder && b.dataset.mode === "page")));
  document.querySelectorAll(".view").forEach(b => b.classList.toggle("on", b.dataset.view === view.mode));
  $("#binderBar").hidden = $("#binderSearch").hidden = !binder;
  $("#pageSelect").innerHTML = Array.from({ length: pages }, (_, i) => `<option>${i + 1}</option>`).join("");
  $("#pageSelect").value = view.page;
  $("#pageCount").textContent = t("of", { n: pages });
  $("#prev").disabled = view.binder === 1 && view.page === 1;
  $("#next").disabled = view.binder === 2 && view.page === pages;
  $("#pageView").hidden = view.mode !== "page";
  $("#overView").hidden = view.mode !== "overview";
  $("#wishView").hidden = view.mode !== "wish";
  $("#statsView").hidden = view.mode !== "stats";
  $("#dataView").hidden = view.mode !== "data";
  ({ page: renderPage, overview: renderOverview, wish: renderWishView, stats: renderCollection, data: () => {} })[view.mode]();
  if (pick.n) renderPicker();
  writeHash();
}

function turnPage(delta) {
  let { binder, page } = view;
  page += delta;
  if (page < 1) [binder, page] = binder === 2 ? [1, pageCount(1)] : [1, 1];
  else if (page > pageCount(binder)) [binder, page] = binder === 1 ? [2, 1] : [2, pageCount(2)];
  Object.assign(view, { binder, page });
  render();
}

function goTo(n) {
  const { binder, page } = locate(n);
  Object.assign(view, { binder, page, mode: "page" });
  render();
  const el = $(`.slot[data-n="${n}"]`);
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
  el?.classList.add("flash");
}

// ---------- Kartenauswahl ----------
const pick = { n: null };

function openPicker(n) {
  const p = BY_N.get(n), e = owned(n);
  pick.n = n;
  $("#pickerTitle").textContent = `${pad(n)} ${p.name}`;
  $("#pickerSub").textContent = `${p.alt !== p.name ? p.alt + " · " : ""}${t("cardsKnown", { n: cardsFor(n).length })}`;
  $("#pickerSprite").src = spriteUrl(n);
  $("#pickerNote").value = e?.note || "";
  $("#noDesignRarity").value = e?.r || "normal";
  const card = findCard(n, e?.card);
  $("#pickerPrice").textContent = "";
  if (card) showPrice($("#pickerPrice"), card, e.r === "reverse");
  renderPicker();
  openModal("#picker");
  $("#designs").scrollTop = 0;
}

// Alle Karten, gruppiert nach Stufe (cardsFor ist schon so sortiert).
function renderPicker() {
  const e = owned(pick.n), cards = cardsFor(pick.n);
  const tierOf = c => RARITY[c.cat].tier;
  const counts = countBy(cards, tierOf);
  $("#btnClear").disabled = !e;
  $("#designs").innerHTML = !cards.length ? `<p class="sub">${t("noCards")}</p>` : cards.map((c, i) => {
    const tier = TIER[tierOf(c)];
    const head = i && tierOf(cards[i - 1]) === tier.id ? "" : `<h4 class="group" ${colorStyle(tier)}><i></i>${esc(tier.label)} <small>${counts[tier.id]}</small></h4>`;
    return `${head}<button class="design${e?.card === c.id ? " sel" : ""}" data-card="${esc(c.id)}" ${colorStyle(tier)}>
      <div class="dhead"><span class="sym">${symbolFor(c.rarity)}</span><span class="rname">${esc(c.rarity === "None" ? t("noRarity") : c.rarity)}</span>${
        REVERSE_FROM.includes(c.cat) ? `<span class="rev${e?.card === c.id && e.r === "reverse" ? " on" : ""}" data-rev title="${t("reverseTip")}">Reverse</span>` : ""}</div>
      ${cardImage(c, `<span>${esc(c.name)}</span>`)}
      <div class="dmeta"><b>${esc(c.set)}</b><span>${esc(c.num)}/${esc(c.total)} · ${esc(c.date.slice(0, 4))}</span></div>
    </button>`;
  }).join("");
}

async function commit(entry) {
  const n = pick.n, prev = RARITY[owned(n)?.r];
  if (entry && prev && RARITY[entry.r].rank < prev.rank) toast(t("rarerHint", { a: prev.label, b: RARITY[entry.r].label }));
  closeModals();
  let done;
  asStep("", () => {  // Karte setzen und Wunsch erfüllen = ein Rückgängig-Schritt
    if (entry?.card && isWished(entry.card)) setWish(entry.card, false).catch(() => setStatus("err", t("saveFailed")));
    done = saveEntry(n, entry);
  });
  render();
  try { await done; } catch { setStatus("err", t("saveFailed")); }
}
// Klick auf die Karte wählt sie, Klick auf „Reverse“ wählt sie als Reverse Holo.
function choose(cardId, asReverse) {
  const card = findCard(pick.n, cardId);
  commit({ r: asReverse ? "reverse" : card.cat, card: card.id, note: $("#pickerNote").value.trim() });
}

// ---------- Sammlung: Statistik und Wert (js/prices.js) ----------
const coll = { tab: "stats" };
function renderCollection() {
  document.querySelectorAll(".ctab").forEach(b => b.classList.toggle("on", b.dataset.ctab === coll.tab));
  (coll.tab === "value" ? renderValue : renderStats)();
}

function renderStats() {
  const entries = Object.values(collection);
  const counts = countBy(entries, e => RARITY[e.r].tier);
  const max = Math.max(1, ...Object.values(counts));
  const binderTile = b => progressTile(`Binder ${b}`, ownedCount(p => inBinder(b, p.n)), DEX.filter(p => inBinder(b, p.n)).length);
  $("#statsBody").innerHTML = `
    <div class="stat-tiles">${progressTile(t("total"), entries.length, DEX.length)}${binderTile(1)}${binderTile(2)}</div>
    <h3>${t("byRarity")}</h3>
    <div class="bars">${TIERS.map(t => `
      <div class="barrow"><span class="bl"><i style="background:${t.color}"></i>${esc(t.label)}</span>
      <span class="bt"><span style="width:${((counts[t.id] || 0) / max) * 100}%;background:${t.color}"></span></span>
      <b>${counts[t.id] || 0}</b></div>`).join("")}</div>
    <p class="sub">${t("withDesign", { a: entries.filter(e => e.card).length, b: entries.length })}</p>`;
}

// ---------- Rückgängig / Wiederholen (js/history.js) ----------
async function undoRedo(dir) {
  const res = stepHistory(dir);
  if (!res) return toast(t(dir < 0 ? "nothingUndo" : "nothingRedo"));
  const s = res.step;
  if (closeZoom() || pick.n) closeModals();
  // Einzelner Slot auf einer anderen Binderseite: dorthin blättern
  const o = s.ops.length === 1 && s.ops[0].kind === "slot" ? s.ops[0] : null;
  if (o && view.mode === "page" && !$(`.slot[data-n="${o.key}"]`)) goTo(+o.key); else render();
  if (o && view.mode === "page") $(`.slot[data-n="${o.key}"]`)?.classList.add("flash");
  toast(t(dir < 0 ? "undone" : "redone", { x: stepLabel(s) }));
  try { await res.done; } catch { setStatus("err", t("saveFailed")); }
}

// ---------- Suche ----------
const suggest = { hits: [], active: 0 };

function renderSuggest() {
  const q = $("#search").value;
  suggest.hits = search(q);
  suggest.active = 0;
  $("#suggest").hidden = !q.trim();
  $("#suggest").innerHTML = !suggest.hits.length ? `<li class="none">${t("nothingFound")}</li>` : suggest.hits.map((p, i) => {
    const loc = locate(p.n), r = RARITY[owned(p.n)?.r];
    return `<li data-i="${i}" class="${i ? "" : "active"}"><img src="${spriteUrl(p.n)}" alt="">
      <div><div><b>${esc(p.name)}</b> <span class="en">${p.alt !== p.name ? esc(p.alt) : ""}</span></div>
      <div class="en">${pad(p.n)} · ${r ? esc(r.label) : t("missingYet")}</div></div>
      <span class="where">${t("where", { b: loc.binder, p: loc.page, slot: slotText(loc) })}</span></li>`;
  }).join("");
}

function pickSuggestion(i) {
  const p = suggest.hits[i];
  if (!p) return;
  $("#suggest").hidden = true;
  $("#search").blur();
  goTo(p.n);
}

// ---------- Adresse (#b1-s3, #b2-s1-ue Übersicht, -wl Wunschliste, -st Statistik, -da Daten) ----------
const HASH_MODES = { "": "page", "-ue": "overview", "-wl": "wish", "-st": "stats", "-da": "data" };
function readHash() {
  const m = location.hash.match(/^#b([12])-s(\d+)(-ue|-wl|-st|-da)?$/);
  if (m) Object.assign(view, { binder: +m[1], page: +m[2], mode: HASH_MODES[m[3] || ""] });
}
function writeHash() {
  const suffix = Object.keys(HASH_MODES).find(k => HASH_MODES[k] === view.mode);
  const h = `#b${view.binder}-s${view.page}${suffix}`;
  if (location.hash !== h) try { history.replaceState(null, "", h); } catch { /* egal */ }
}

// ---------- Events ----------
const on = (sel, type, fn) => $(sel).addEventListener(type, fn);
const onClosest = (sel, type, child, fn) => on(sel, type, e => { const el = e.target.closest(child); if (el) fn(el, e); });

function bindEvents() {
  $("#lang").innerHTML = LANGS.map(l => `<option value="${l.id}"${l.disabled ? " disabled" : ""}>${esc(l.label)}</option>`).join("");
  $("#lang").value = LANG;
  on("#lang", "change", e => setLang(e.target.value));
  $("#noDesignRarity").innerHTML = RARITIES.map(r => `<option value="${r.id}">${esc(r.label)}</option>`).join("");
  document.querySelectorAll(".tab").forEach(b => (b.onclick = () => { Object.assign(view, { binder: +b.dataset.binder, page: 1 }); render(); }));
  document.querySelectorAll(".view").forEach(b => (b.onclick = () => { view.mode = b.dataset.view; render(); }));
  document.querySelectorAll(".sect").forEach(b => (b.onclick = () => {
    if (b.dataset.mode !== "page") view.mode = b.dataset.mode;
    else if (!["page", "overview"].includes(view.mode)) view.mode = view.binderMode || "page";
    render();
    scrollTo({ top: 0 });
  }));
  on("#filter", "change", e => { view.filter = e.target.value; render(); });
  on("#pageSelect", "change", e => { view.page = +e.target.value; render(); });
  on("#prev", "click", () => turnPage(-1));
  on("#next", "click", () => turnPage(1));
  document.querySelectorAll(".ctab").forEach(b => (b.onclick = () => { coll.tab = b.dataset.ctab; renderCollection(); }));
  onClosest("#statsBody", "click", "#btnValue", loadCollectionValue);
  onClosest("#statsBody", "click", ".top-cards li[data-n]", li => goTo(+li.dataset.n));
  onClosest("#overView", "click", ".mini", m => { Object.assign(view, { page: +m.dataset.page, mode: "page" }); render(); scrollTo({ top: 0 }); });

  onClosest("#grid", "click", ".slot[data-n]", (slot, e) => { if (e.target.closest(".rbtn, .vis")) openPicker(+slot.dataset.n); });
  onClosest("#designs", "click", ".design", (d, e) => choose(d.dataset.card, !!e.target.closest("[data-rev]")));
  on("#btnNoDesign", "click", () => commit({ r: $("#noDesignRarity").value, card: "", note: $("#pickerNote").value.trim() }));
  on("#btnClear", "click", () => commit(null));
  on("#pickerNote", "keydown", e => { if (e.key === "Enter" && owned(pick.n)) commit({ ...owned(pick.n), note: e.target.value.trim() }); });
  document.querySelectorAll(".modal .x, #modalBack").forEach(el => (el.onclick = closeModals));
  on("#zoom", "click", e => { if (!e.target.closest("img")) closeZoom(); });

  on("#search", "input", renderSuggest);
  on("#search", "focus", e => e.target.value && renderSuggest());
  on("#search", "keydown", e => {
    const items = document.querySelectorAll("#suggest li[data-i]");
    if (e.key === "Enter") pickSuggestion(suggest.active);
    else if (e.key === "Escape") $("#suggest").hidden = true;
    else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && items.length) {
      e.preventDefault();
      suggest.active = (suggest.active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.classList.toggle("active", i === suggest.active));
    }
  });
  onClosest("#suggest", "click", "li[data-i]", li => pickSuggestion(+li.dataset.i));
  document.addEventListener("click", e => { if (!e.target.closest(".search")) $("#suggest").hidden = true; });

  on("#btnUndo", "click", () => undoRedo(-1));
  on("#btnRedo", "click", () => undoRedo(1));
  document.addEventListener("keydown", e => {
    const key = e.key.toLowerCase();
    // Strg+Z / Strg+Y / Strg+Umschalt+Z (Mac: Cmd); in Textfeldern bleibt es beim Text-Rückgängig
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (key === "z" || key === "y") && !e.target.matches("input, textarea")) {
      e.preventDefault();
      return undoRedo(key === "y" || e.shiftKey ? 1 : -1);
    }
    if (e.key === "Escape") return closeZoom() || closeModals();
    if (e.target.matches("input, select") || document.body.classList.contains("modal-open") || view.mode !== "page") return;
    if (e.key === "ArrowLeft") turnPage(-1);
    if (e.key === "ArrowRight") turnPage(1);
    if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
  });

  on("#btnExport", "click", async () => {
    try {
      await saveFile(`binder-backup-${new Date().toISOString().slice(0, 10)}.json`, backupJson());
      toast(t("backupSaved"));
    } catch (err) {
      if (err?.code !== "declined") toast(t("backupNotSaved"));
    }
  });
  on("#fileImport", "change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const next = parseBackup(await file.text());
      askConfirm(t("backupAsk", { n: Object.keys(next.collection).length }), async () => {
        await asStep(t("backupStep"), async () => {
          await replaceCollection(next.collection).catch(() => setStatus("err", t("saveFailed")));
          if (next.wishlist) await replaceWishlist(next.wishlist).catch(() => setStatus("err", t("saveFailed")));
        });
        render();
        toast(t("backupLoaded"));
      });
    } catch {
      toast(t("backupInvalid"));
    }
  });
}

// ---------- Start ----------
applyStaticText();
loadLocal();
loadWishLocal();
addEventListener("hashchange", () => { readHash(); render(); });
readHash();
bindEvents();
bindWishEvents();
render();
connectLive(setStatus, render);
connectWishLive(() => view.mode === "wish" && renderWishView());
