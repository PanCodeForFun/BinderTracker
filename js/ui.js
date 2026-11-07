// Oberfläche: Binderseite, Übersicht, Kartenauswahl, Statistik, Suche.

const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const rarityStyle = r => (r ? `style="--r:${r.color};--rInk:${r.ink}"` : "");

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

// Kartenbild, das bei fehlendem Internet (oder auf claude.ai) zur Textkarte wird.
function cardImage(card, extra = "") {
  return `<div class="cardbox" data-imgbox>
    <img src="${esc(card.small)}" alt="${esc(card.name)}" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">
    <div class="textcard">${extra}<b>${esc(card.set)}</b><span>${esc(card.num)}/${esc(card.total)}</span></div>
  </div>`;
}

function progressTile(label, have, total) {
  return `<div class="stat"><div class="big">${have} / ${total}</div><div class="lbl">${label} (${pct(have, total)} %)</div>
    <div class="progress"><span style="width:${pct(have, total)}%"></span></div></div>`;
}

// ---------- Binderseite ----------
function slotHtml(n) {
  const p = BY_N.get(n), loc = locate(n);
  const corner = `<span class="pos">${loc.row}/${loc.col}</span><span class="num">${pad(n)}</span>`;
  if (!p) return `<div class="slot future">${corner}<div class="free">frei für neue Pokémon</div></div>`;

  const e = owned(n), r = e && RARITY[e.r], card = e && findCard(n, e.card);
  const dim = (view.filter === "missing" && e) || (view.filter === "have" && !e);
  const visual = card
    ? cardImage(card, `<img class="spr" src="${spriteUrl(n)}" alt="">`)
    : `<img class="spr" src="${spriteUrl(n)}" alt="">`;
  const sub = card ? `${card.set} · ${card.num}` : p.en !== p.de ? p.en : "";

  return `<div class="slot${e ? " have" : ""}${dim ? " dim" : ""}" data-n="${n}" ${rarityStyle(r)}>
    ${corner}
    <div class="vis">${visual}</div>
    <div class="de">${esc(p.de)}</div>
    <div class="sub">${esc(sub) || "&nbsp;"}</div>
    <button class="rbtn">${r ? esc(r.label) : "+ Karte wählen"}</button>
  </div>`;
}

function renderPage() {
  const start = firstOnPage(view.binder, view.page);
  const numbers = Array.from({ length: LAYOUT.slotsPerPage }, (_, i) => start + i);
  $("#pageTitle").textContent = `Binder ${view.binder} · Seite ${view.page}`;
  $("#pageRange").textContent = `${pad(start)} bis ${pad(Math.min(start + LAYOUT.slotsPerPage - 1, Math.max(start, MAX_N)))}`;
  $("#pageProgress").textContent =
    `${ownedCount(p => inBinder(view.binder, p.n))} / ${DEX.filter(p => inBinder(view.binder, p.n)).length} im Binder`;
  $("#grid").innerHTML = numbers.map(slotHtml).join("");
}

function renderOverview() {
  let html = "";
  for (let page = 1; page <= pageCount(view.binder); page++) {
    const start = firstOnPage(view.binder, page);
    const numbers = Array.from({ length: LAYOUT.slotsPerPage }, (_, i) => start + i);
    const cells = numbers.map(n => {
      const p = BY_N.get(n), r = RARITY[owned(n)?.r];
      return `<span class="${!p ? "void" : r ? "have" : ""}" ${rarityStyle(r)} title="${p ? esc(pad(n) + " " + p.de) : "frei"}"></span>`;
    });
    const have = numbers.filter(owned).length, real = numbers.filter(n => BY_N.has(n)).length;
    html += `<button class="mini" data-page="${page}"><div class="t"><b>Seite ${page}</b><span>${have}/${real}</span></div><div class="g">${cells.join("")}</div></button>`;
  }
  $("#overView").innerHTML = html;
}

function render() {
  const pages = pageCount(view.binder);
  view.page = Math.min(Math.max(1, view.page), pages);
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", +b.dataset.binder === view.binder));
  document.querySelectorAll(".view").forEach(b => b.classList.toggle("on", b.dataset.view === view.mode));
  $("#pageSelect").innerHTML = Array.from({ length: pages }, (_, i) => `<option>${i + 1}</option>`).join("");
  $("#pageSelect").value = view.page;
  $("#pageCount").textContent = `von ${pages}`;
  $("#prev").disabled = view.binder === 1 && view.page === 1;
  $("#next").disabled = view.binder === 2 && view.page === pages;
  $("#pageView").hidden = view.mode !== "page";
  $("#overView").hidden = view.mode !== "overview";
  (view.mode === "page" ? renderPage : renderOverview)();
  if (!$("#statsModal").hidden) renderStats();
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
const pick = { n: null, rarity: null };

function openPicker(n) {
  const p = BY_N.get(n);
  Object.assign(pick, { n, rarity: owned(n)?.r || null });
  $("#pickerTitle").textContent = `${pad(n)} ${p.de}`;
  $("#pickerSub").textContent = `${p.en !== p.de ? p.en + " · " : ""}${cardsFor(n).length} Karten bekannt`;
  $("#pickerSprite").src = spriteUrl(n);
  $("#pickerNote").value = owned(n)?.note || "";
  renderPicker();
  openModal("#picker");
  $("#designs").scrollTop = 0;
}

function renderPicker() {
  const { n, rarity } = pick, e = owned(n);
  $("#pickerOpts").innerHTML = RARITIES.map(r => `
    <button class="rchip${rarity === r.id ? " on" : ""}${e?.r === r.id ? " owned" : ""}" data-r="${r.id}" ${rarityStyle(r)} title="${esc(r.hint)}">
      <i></i>${esc(r.label)}<small>${cardsOfRarity(n, r.id).length}</small></button>`).join("");
  $("#btnClear").disabled = !e;
  $("#btnNoDesign").disabled = !rarity;

  const cards = rarity ? cardsOfRarity(n, rarity) : [];
  $("#designCount").textContent = rarity ? `${cards.length} Karten` : "";
  $("#designHint").textContent =
    !rarity ? "Wähle oben eine Seltenheit, dann siehst du alle passenden Karten."
    : !cards.length ? "Für diese Seltenheit ist keine Karte von diesem Pokémon bekannt. Du kannst sie trotzdem ohne Design übernehmen."
    : rarity === "reverse" ? "Reverse Holos gibt es von fast jeder normalen Karte. Wähle die Karte, die du als Reverse hast."
    : "Tippe auf deine Karte.";
  $("#designs").innerHTML = cards.map(c => `
    <button class="design${e?.card === c.id && e.r === rarity ? " sel" : ""}" data-card="${esc(c.id)}">
      ${cardImage(c, `<span>${esc(c.name)}</span>`)}
      <div class="dmeta"><b>${esc(c.set)}</b><span>${esc(c.num)}/${esc(c.total)} · ${esc(c.date.slice(0, 4))}</span><span>${esc(c.rarity)}</span></div>
    </button>`).join("");
}

async function commit(entry) {
  const n = pick.n, prev = RARITY[owned(n)?.r];
  if (entry && prev && RARITY[entry.r].rank < prev.rank) toast(`Hinweis: ${prev.label} war seltener als ${RARITY[entry.r].label}.`);
  closeModals();
  const done = saveEntry(n, entry);
  render();
  try { await done; } catch { setStatus("err", "Online-Speichern fehlgeschlagen"); }
}
const choose = card => commit({ r: pick.rarity, card, note: $("#pickerNote").value.trim() });

// ---------- Statistik ----------
function renderStats() {
  const counts = {};
  for (const e of Object.values(collection)) counts[e.r] = (counts[e.r] || 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  const total = ownedCount(() => true);
  const binderTile = b => progressTile(`Binder ${b}`, ownedCount(p => inBinder(b, p.n)), DEX.filter(p => inBinder(b, p.n)).length);
  $("#statsBody").innerHTML = `
    <div class="stat-tiles">${progressTile("gesamt", total, DEX.length)}${binderTile(1)}${binderTile(2)}</div>
    <h3>Nach Seltenheit</h3>
    <div class="bars">${RARITIES.map(r => `
      <div class="barrow"><span class="bl"><i style="background:${r.color}"></i>${esc(r.label)}</span>
      <span class="bt"><span style="width:${((counts[r.id] || 0) / max) * 100}%;background:${r.color}"></span></span>
      <b>${counts[r.id] || 0}</b></div>`).join("")}</div>
    <p class="sub">${Object.values(collection).filter(e => e.card).length} von ${total} Karten mit gewähltem Kartendesign.</p>`;
}

// ---------- Suche ----------
const suggest = { hits: [], active: 0 };

function renderSuggest() {
  const q = $("#search").value;
  suggest.hits = search(q);
  suggest.active = 0;
  $("#suggest").hidden = !q.trim();
  $("#suggest").innerHTML = !suggest.hits.length ? `<li class="none">Nichts gefunden</li>` : suggest.hits.map((p, i) => {
    const loc = locate(p.n), r = RARITY[owned(p.n)?.r];
    return `<li data-i="${i}" class="${i ? "" : "active"}"><img src="${spriteUrl(p.n)}" alt="">
      <div><div><b>${esc(p.de)}</b> <span class="en">${p.en !== p.de ? esc(p.en) : ""}</span></div>
      <div class="en">${pad(p.n)} · ${r ? esc(r.label) : "fehlt noch"}</div></div>
      <span class="where">B${loc.binder} · S. ${loc.page} · ${slotText(loc)}</span></li>`;
  }).join("");
}

function pickSuggestion(i) {
  const p = suggest.hits[i];
  if (!p) return;
  $("#suggest").hidden = true;
  $("#search").blur();
  goTo(p.n);
}

// ---------- Adresse (#b1-s3, #b2-s1-ue) ----------
function readHash() {
  const m = location.hash.match(/^#b([12])-s(\d+)(-ue)?$/);
  if (m) Object.assign(view, { binder: +m[1], page: +m[2], mode: m[3] ? "overview" : "page" });
}
function writeHash() {
  const h = `#b${view.binder}-s${view.page}${view.mode === "overview" ? "-ue" : ""}`;
  if (location.hash !== h) try { history.replaceState(null, "", h); } catch { /* egal */ }
}

// ---------- Events ----------
const on = (sel, type, fn) => $(sel).addEventListener(type, fn);
const onClosest = (sel, type, child, fn) => on(sel, type, e => { const el = e.target.closest(child); if (el) fn(el, e); });

function bindEvents() {
  document.querySelectorAll(".tab").forEach(b => (b.onclick = () => { Object.assign(view, { binder: +b.dataset.binder, page: 1 }); render(); }));
  document.querySelectorAll(".view").forEach(b => (b.onclick = () => { view.mode = b.dataset.view; render(); }));
  on("#filter", "change", e => { view.filter = e.target.value; render(); });
  on("#pageSelect", "change", e => { view.page = +e.target.value; render(); });
  on("#prev", "click", () => turnPage(-1));
  on("#next", "click", () => turnPage(1));
  onClosest("#overView", "click", ".mini", m => { Object.assign(view, { page: +m.dataset.page, mode: "page" }); render(); scrollTo({ top: 0 }); });

  onClosest("#grid", "click", ".slot[data-n]", (slot, e) => { if (e.target.closest(".rbtn, .vis")) openPicker(+slot.dataset.n); });
  onClosest("#pickerOpts", "click", ".rchip", b => { pick.rarity = b.dataset.r; renderPicker(); $("#designs").scrollTop = 0; });
  onClosest("#designs", "click", ".design", d => choose(d.dataset.card));
  on("#btnNoDesign", "click", () => choose(""));
  on("#btnClear", "click", () => commit(null));
  on("#pickerNote", "keydown", e => { if (e.key === "Enter" && owned(pick.n)) commit({ ...owned(pick.n), note: e.target.value.trim() }); });
  on("#btnStats", "click", () => { renderStats(); openModal("#statsModal"); });
  document.querySelectorAll(".modal .x, #modalBack").forEach(el => (el.onclick = closeModals));

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

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") return closeModals();
    if (e.target.matches("input, select") || document.body.classList.contains("modal-open") || view.mode !== "page") return;
    if (e.key === "ArrowLeft") turnPage(-1);
    if (e.key === "ArrowRight") turnPage(1);
    if (e.key === "/") { e.preventDefault(); $("#search").focus(); }
  });

  on("#btnExport", "click", async () => {
    try {
      await saveFile(`binder-backup-${new Date().toISOString().slice(0, 10)}.json`, backupJson());
      toast("Backup gespeichert.");
    } catch (err) {
      if (err?.code !== "declined") toast("Backup wurde nicht gespeichert.");
    }
  });
  on("#fileImport", "change", async e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const next = parseBackup(await file.text());
      askConfirm(`Backup mit ${Object.keys(next).length} Karten laden? Deine aktuellen Einträge werden ersetzt.`, async () => {
        await replaceCollection(next).catch(() => setStatus("err", "Online-Speichern fehlgeschlagen"));
        render();
        toast("Backup geladen.");
      });
    } catch {
      toast("Die Datei ist kein gültiges Backup.");
    }
  });
}

// ---------- Start ----------
loadLocal();
addEventListener("hashchange", () => { readHash(); render(); });
readHash();
bindEvents();
render();
connectLive(setStatus, render);
