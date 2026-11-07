/* Pokémon Binder Tracker
 * Lokal: index.html im Browser öffnen. Einträge liegen im Browser-Speicher,
 * "Backup speichern" sichert sie als Datei.
 * Live auf claude.ai: Einträge liegen zusätzlich im Online-Speicher der Seite.
 */
(function () {
  "use strict";

  // ---------- Einstellungen ----------
  const SLOTS_PER_PAGE = 16;   // 4 x 4
  const COLS = 4;
  const BINDER1_CAPACITY = 640; // Binder 1: #1 bis #640 (40 Seiten), danach Binder 2
  const STORAGE_KEY = "pokebinder.v1";
  const DB_COLLECTION = "karten";

  // Seltenheiten, sortiert von häufig nach selten. Die id wird gespeichert.
  // pool = welche Kartenkategorien aus der Datenbank zur Auswahl stehen.
  const RARITIES = [
    { id: "normal",  label: "Normal",                    hint: "Common, Uncommon, Rare",          color: "#9aa3ad", ink: "#111", pool: ["normal"] },
    { id: "reverse", label: "Reverse Holo",              hint: "Glitzer im Rahmen",              color: "#7cc4c9", ink: "#111", pool: ["normal", "holo"] },
    { id: "holo",    label: "Holo",                      hint: "Glitzer im Bild",                color: "#4f9fe0", ink: "#fff", pool: ["holo"] },
    { id: "promo",   label: "Promo",                     hint: "Promokarten",                    color: "#6b8f5e", ink: "#fff", pool: ["promo"] },
    { id: "shiny",   label: "Shiny",                     hint: "Shiny, Radiant, Amazing",        color: "#2bb39b", ink: "#fff", pool: ["shiny"] },
    { id: "ex",      label: "EX / GX / V / ex",          hint: "Regelkarten",                    color: "#8a5cd6", ink: "#fff", pool: ["ex"] },
    { id: "vmax",    label: "VMAX / VSTAR",              hint: "",                               color: "#b04fc4", ink: "#fff", pool: ["vmax"] },
    { id: "fullart", label: "Full Art",                  hint: "Ultra Rare",                     color: "#e0559a", ink: "#fff", pool: ["fullart"] },
    { id: "ir",      label: "Illustration Rare",         hint: "inkl. Trainer Gallery",          color: "#f07a3a", ink: "#111", pool: ["ir"] },
    { id: "sir",     label: "Special Illustration Rare", hint: "SAR",                            color: "#e2402f", ink: "#fff", pool: ["sir"] },
    { id: "hyper",   label: "Hyper / Gold / Rainbow",    hint: "Secret Rare",                    color: "#d4a514", ink: "#111", pool: ["hyper"] },
  ];
  const R = Object.fromEntries(RARITIES.map((r, i) => [r.id, Object.assign({ rank: i }, r)]));

  // ---------- Daten ----------
  const DEX = (window.POKEDEX || []).map(([n, de, en, gen]) => ({ n, de, en, gen }));
  const BY_N = new Map(DEX.map(p => [p.n, p]));
  const MAX_N = DEX.length ? DEX[DEX.length - 1].n : 0;
  const SETS = window.TCG_SETS || [];
  const RNAMES = window.TCG_RARITY_NAMES || [];
  const RAW_CARDS = window.TCG_CARDS || {};

  // Karten eines Pokémon, neueste zuerst
  const cardCache = new Map();
  function cardsFor(n) {
    if (cardCache.has(n)) return cardCache.get(n);
    const list = (RAW_CARDS[n] || []).map(([si, num, cat, name, ri, img]) => {
      const s = SETS[si] || ["?", "?", "", "", ""];
      let small;
      if (img && /^https?:/.test(img)) small = img;
      else small = "https://images.pokemontcg.io/" + (img || `${s[0]}/${num}.png`);
      const large = small.endsWith("/small") ? small.replace(/\/small$/, "/large") : small.replace(/\.png$/, "_hires.png");
      return { id: `${s[0]}-${num}`, set: s[1], series: s[2], date: s[3], total: s[4], num, cat, name, rarity: RNAMES[ri] || "", small, large, order: si };
    }).sort((a, b) => b.order - a.order || String(a.num).localeCompare(String(b.num), "en", { numeric: true }));
    cardCache.set(n, list);
    return list;
  }
  function findCard(n, id) { return id ? cardsFor(n).find(c => c.id === id) : null; }

  let col = loadLocal(); // { "25": { r: "holo", card: "sv3pt5-25", note: "" } }

  function cleanEntry(n, v) {
    if (!v || !R[v.r] || !BY_N.has(+n)) return null;
    return { r: v.r, card: typeof v.card === "string" ? v.card : "", note: String(v.note || "") };
  }
  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      const out = {};
      for (const k in obj) { const e = cleanEntry(k, obj[k]); if (e) out[k] = e; }
      return out;
    } catch (e) { return {}; }
  }
  function saveLocal() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(col)); }
    catch (e) { if (!liveDb) toast("Speichern im Browser hat nicht geklappt. Bitte Backup speichern!"); }
  }
  async function persist(n) {
    saveLocal();
    if (!liveDb) return;
    const ref = liveDb.collection(DB_COLLECTION).doc(String(n));
    try {
      if (col[n]) await ref.set({ r: col[n].r, card: col[n].card || "", note: col[n].note || "" });
      else await ref.delete();
    } catch (e) { setStatus("err", "Online-Speichern fehlgeschlagen"); }
  }

  // ---------- Online-Speicher (nur in der Live-Version auf claude.ai) ----------
  let liveDb = null;
  function setStatus(kind, text) {
    const el = document.querySelector("#status");
    if (el) { el.className = "status " + kind; el.textContent = text; }
  }
  function connectLive() {
    if (!window.claude || typeof window.claude.use !== "function") { setStatus("local", "Gespeichert in diesem Browser"); return; }
    setStatus("wait", "Verbinde…");
    window.claude.use("db").then(db => {
      if (!db) { setStatus("local", "Gespeichert in diesem Browser"); return; }
      liveDb = db;
      const timer = setTimeout(() => setStatus("wait", "Online-Speicher noch nicht erreichbar"), 10000);
      db.collection(DB_COLLECTION).onSnapshot(snap => {
        const next = {};
        snap.docs.forEach(d => { const e = cleanEntry(d.id, d.data()); if (e) next[d.id] = e; });
        col = next; saveLocal();
        if (!snap.metadata.fromCache) { clearTimeout(timer); setStatus("live", "Live gespeichert"); }
        render();
        if (!picker.hidden && pickN) renderSlotsOnly();
      }, () => { clearTimeout(timer); liveDb = null; setStatus("err", "Online-Speicher nicht verfügbar"); });
    });
  }

  // ---------- Slot-Rechnung ----------
  function locate(n) {
    const binder = n <= BINDER1_CAPACITY ? 1 : 2;
    const i = binder === 1 ? n - 1 : n - BINDER1_CAPACITY - 1;
    const slot = i % SLOTS_PER_PAGE;
    return { binder, page: Math.floor(i / SLOTS_PER_PAGE) + 1, slot, row: Math.floor(slot / COLS) + 1, col: (slot % COLS) + 1 };
  }
  function firstNumber(binder, page) { return (binder === 1 ? 0 : BINDER1_CAPACITY) + (page - 1) * SLOTS_PER_PAGE + 1; }
  function pageCount(binder) {
    if (binder === 1) return Math.ceil(Math.min(MAX_N, BINDER1_CAPACITY) / SLOTS_PER_PAGE) || 1;
    return Math.max(1, Math.ceil((MAX_N - BINDER1_CAPACITY) / SLOTS_PER_PAGE));
  }
  const ROW_NAMES = ["oben", "2. Reihe", "3. Reihe", "unten"];
  const COL_NAMES = ["links", "2. von links", "3. von links", "rechts"];
  const slotText = loc => `${ROW_NAMES[loc.row - 1]} ${COL_NAMES[loc.col - 1]}`;

  // ---------- Zustand ----------
  const state = { binder: 1, page: 1, view: "page", filter: "all" };
  readHash();

  // ---------- DOM ----------
  const $ = s => document.querySelector(s);
  const grid = $("#grid"), pageSel = $("#pageSelect"), picker = $("#picker"), back = $("#modalBack");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sprite = n => (window.SPRITES && window.SPRITES[n]) || `sprites/${n}.png`;
  const pad = n => "#" + String(n).padStart(4, "0");

  // Kartenbilder kommen aus dem Internet. Wo das nicht erlaubt ist (z. B. auf
  // claude.ai), merken wir uns das und zeigen stattdessen eine Textkarte.
  let imagesBlocked = false;
  window.__cardImgFail = function (img) {
    const box = img.closest("[data-imgbox]");
    if (box) box.classList.add("noimg");
    img.remove();
  };
  window.__cardImgOk = function () { imagesBlocked = false; };

  function render() {
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", +b.dataset.binder === state.binder));
    document.querySelectorAll(".view").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
    const pc = pageCount(state.binder);
    state.page = Math.min(Math.max(1, state.page), pc);
    pageSel.innerHTML = Array.from({ length: pc }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("");
    pageSel.value = state.page;
    $("#pageCount").textContent = `von ${pc}`;
    $("#prev").disabled = state.binder === 1 && state.page === 1;
    $("#next").disabled = state.binder === 2 && state.page === pc;
    $("#pageView").hidden = state.view !== "page";
    $("#overView").hidden = state.view !== "overview";
    document.querySelector(".pager").style.visibility = state.view === "page" ? "visible" : "hidden";
    if (state.view === "page") renderPage(); else renderOverview();
    if (!$("#statsModal").hidden) renderStats();
    writeHash();
  }

  function binderProgress(b) {
    const list = DEX.filter(p => (b === 1 ? p.n <= BINDER1_CAPACITY : p.n > BINDER1_CAPACITY));
    return [list.filter(p => col[p.n]).length, list.length];
  }

  function renderStats() {
    const total = DEX.length;
    const have = DEX.filter(p => col[p.n]).length;
    const [h1, t1] = binderProgress(1), [h2, t2] = binderProgress(2);
    const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
    const counts = {}; let withDesign = 0;
    for (const k in col) { counts[col[k].r] = (counts[col[k].r] || 0) + 1; if (col[k].card) withDesign++; }
    const max = Math.max(1, ...Object.values(counts));
    $("#statsBody").innerHTML = `
      <div class="stat-tiles">
        <div class="stat"><div class="big">${have} / ${total}</div><div class="lbl">gesamt (${pct(have, total)} %)</div><div class="progress"><span style="width:${pct(have, total)}%"></span></div></div>
        <div class="stat"><div class="big">${h1} / ${t1}</div><div class="lbl">Binder 1</div><div class="progress"><span style="width:${pct(h1, t1)}%"></span></div></div>
        <div class="stat"><div class="big">${h2} / ${t2}</div><div class="lbl">Binder 2</div><div class="progress"><span style="width:${pct(h2, t2)}%"></span></div></div>
      </div>
      <h3>Nach Seltenheit</h3>
      <div class="bars">${RARITIES.map(r => `
        <div class="barrow"><span class="bl"><i style="background:${r.color}"></i>${esc(r.label)}</span>
        <span class="bt"><span style="width:${(counts[r.id] || 0) / max * 100}%;background:${r.color}"></span></span>
        <b>${counts[r.id] || 0}</b></div>`).join("")}</div>
      <p class="sub">${withDesign} von ${have} Karten mit gewähltem Kartendesign.</p>`;
  }

  function slotVisual(n, e) {
    const c = e && findCard(n, e.card);
    if (c) {
      return `<div class="vis card" data-imgbox>
        <img class="cardimg" src="${esc(c.small)}" alt="${esc(c.name)}" loading="lazy" onerror="__cardImgFail(this)" onload="__cardImgOk()">
        <div class="textcard"><img src="${sprite(n)}" alt=""><span class="tc-set">${esc(c.set)}</span><span class="tc-num">${esc(c.num)}/${esc(c.total)}</span></div>
      </div>`;
    }
    return `<div class="vis"><img class="spr" src="${sprite(n)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"></div>`;
  }

  function renderPage() {
    const start = firstNumber(state.binder, state.page);
    const end = start + SLOTS_PER_PAGE - 1;
    $("#pageTitle").textContent = `Binder ${state.binder} · Seite ${state.page}`;
    $("#pageRange").textContent = `${pad(start)} bis ${pad(Math.min(end, Math.max(start, MAX_N)))}`;
    const [h, t] = binderProgress(state.binder);
    $("#pageProgress").textContent = `${h} / ${t} im Binder`;
    let html = "";
    for (let n = start; n <= end; n++) {
      const p = BY_N.get(n);
      const loc = locate(n);
      if (!p) {
        html += `<div class="slot future"><span class="pos">${loc.row}/${loc.col}</span><span class="num">${pad(n)}</span>
          <div class="free">frei für neue Pokémon</div></div>`;
        continue;
      }
      const e = col[n];
      const r = e && R[e.r];
      const c = e && findCard(n, e.card);
      const dim = (state.filter === "missing" && r) || (state.filter === "have" && !r);
      const style = r ? `style="--r:${r.color};--rInk:${r.ink}"` : "";
      html += `<div class="slot${r ? " have" : ""}${dim ? " dim" : ""}" data-n="${n}" ${style}>
        <span class="pos" title="Reihe ${loc.row}, Spalte ${loc.col}">${loc.row}/${loc.col}</span>
        <span class="num">${pad(n)}</span>
        ${slotVisual(n, e)}
        <div class="de">${esc(p.de)}</div>
        <div class="enName">${c ? esc(c.set) + " · " + esc(c.num) : (p.en !== p.de ? esc(p.en) : "&nbsp;")}</div>
        <button class="rbtn" data-n="${n}">${r ? esc(r.label) : "+ Karte wählen"}</button>
      </div>`;
    }
    grid.innerHTML = html;
  }

  function renderOverview() {
    const pc = pageCount(state.binder);
    let html = "";
    for (let pg = 1; pg <= pc; pg++) {
      const start = firstNumber(state.binder, pg);
      let have = 0, real = 0, cells = "";
      for (let n = start; n < start + SLOTS_PER_PAGE; n++) {
        const p = BY_N.get(n);
        const r = col[n] && R[col[n].r];
        if (p) real++;
        if (r) have++;
        cells += `<span class="${!p ? "void" : r ? "have" : ""}" ${r ? `style="--r:${r.color}"` : ""} title="${p ? esc(pad(n) + " " + p.de) : "frei"}"></span>`;
      }
      html += `<button class="mini" data-page="${pg}"><div class="t"><b>Seite ${pg}</b><span>${have}/${real}</span></div><div class="g">${cells}</div></button>`;
    }
    $("#overView").innerHTML = html;
  }

  // ---------- Karte wählen (Seltenheit + Design) ----------
  let pickN = null, pickR = null;
  function openPicker(n) {
    pickN = n;
    const p = BY_N.get(n), e = col[n];
    pickR = e ? e.r : null;
    $("#pickerTitle").textContent = `${pad(n)} ${p.de}`;
    $("#pickerSub").textContent = `${p.en !== p.de ? p.en + " · " : ""}${cardsFor(n).length} Karten bekannt`;
    $("#pickerSprite").src = sprite(n);
    $("#pickerNote").value = (e && e.note) || "";
    renderSlotsOnly();
    back.hidden = false; picker.hidden = false;
    document.body.classList.add("modal-open");
    $("#designs").scrollTop = 0;
  }
  function closePicker() {
    picker.hidden = true; pickN = null; pickR = null;
    if ($("#statsModal").hidden) { back.hidden = true; document.body.classList.remove("modal-open"); }
  }
  function poolCount(n, r) { return cardsFor(n).filter(c => r.pool.includes(c.cat)).length; }

  function renderSlotsOnly() {
    const n = pickN, e = col[n];
    $("#pickerOpts").innerHTML = RARITIES.map(r => {
      const cnt = poolCount(n, r);
      return `<button class="rchip${pickR === r.id ? " on" : ""}${e && e.r === r.id ? " owned" : ""}" data-r="${r.id}" style="--r:${r.color};--rInk:${r.ink}" title="${esc(r.hint)}">
        <i></i>${esc(r.label)}<small>${cnt}</small></button>`;
    }).join("");
    const box = $("#designs"), hint = $("#designHint");
    if (!pickR) {
      box.innerHTML = ""; hint.textContent = "Wähle oben eine Seltenheit, dann siehst du alle passenden Karten.";
      $("#designCount").textContent = ""; $("#btnNoDesign").disabled = true;
      $("#btnClear").disabled = !e;
      return;
    }
    const r = R[pickR];
    const list = cardsFor(n).filter(c => r.pool.includes(c.cat));
    $("#designCount").textContent = `${list.length} Karten`;
    $("#btnNoDesign").disabled = false;
    $("#btnClear").disabled = !e;
    hint.textContent = list.length
      ? (pickR === "reverse" ? "Reverse Holos gibt es von fast jeder normalen Karte. Wähle die Karte, die du als Reverse hast." : "Tippe auf deine Karte.")
      : "Für diese Seltenheit ist keine Karte von diesem Pokémon bekannt. Du kannst sie trotzdem ohne Design übernehmen.";
    box.innerHTML = list.map(c => {
      const sel = e && e.card === c.id && e.r === pickR;
      return `<button class="design${sel ? " sel" : ""}" data-card="${esc(c.id)}">
        <div class="dimg" data-imgbox>
          <img src="${esc(c.small)}" alt="" loading="lazy" onerror="__cardImgFail(this)">
          <div class="textcard"><span class="tc-name">${esc(c.name)}</span><span class="tc-set">${esc(c.set)}</span><span class="tc-num">${esc(c.num)}/${esc(c.total)}</span></div>
        </div>
        <div class="dmeta"><b>${esc(c.set)}</b><span>${esc(c.num)}/${esc(c.total)} · ${esc(c.date.slice(0, 4))}</span><span class="rr">${esc(c.rarity)}</span></div>
      </button>`;
    }).join("");
  }

  function choose(card) {
    const n = pickN;
    const prev = col[n];
    col[n] = { r: pickR, card: card || "", note: $("#pickerNote").value.trim() };
    if (prev && R[prev.r] && R[pickR].rank < R[prev.r].rank)
      toast(`Hinweis: ${R[prev.r].label} war seltener als ${R[pickR].label}.`);
    persist(n);
    closePicker();
    render();
  }

  // ---------- Suche ----------
  function norm(s) {
    return s.toLowerCase().replace(/♀/g, "w").replace(/♂/g, "m").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");
  }
  const INDEX = DEX.map(p => ({ p, de: norm(p.de), en: norm(p.en) }));
  function search(q) {
    q = q.trim();
    if (!q) return [];
    const num = q.replace(/^#/, "");
    if (/^\d+$/.test(num)) { const p = BY_N.get(+num); return p ? [p] : []; }
    const k = norm(q);
    if (!k) return [];
    const scored = [];
    for (const x of INDEX) {
      let s = -1;
      if (x.de === k || x.en === k) s = 0;
      else if (x.de.startsWith(k) || x.en.startsWith(k)) s = 1;
      else if (x.de.includes(k) || x.en.includes(k)) s = 2;
      if (s >= 0) scored.push([s, x.p]);
    }
    return scored.sort((a, b) => a[0] - b[0] || a[1].n - b[1].n).slice(0, 12).map(x => x[1]);
  }
  let sugg = [], active = 0;
  const input = $("#search"), list = $("#suggest");
  function showSuggest() {
    sugg = search(input.value);
    active = 0;
    if (!sugg.length) {
      list.innerHTML = input.value.trim() ? `<li class="none">Nichts gefunden</li>` : "";
      list.hidden = !input.value.trim();
      return;
    }
    list.innerHTML = sugg.map((p, i) => {
      const l = locate(p.n), e = col[p.n], r = e && R[e.r];
      return `<li data-i="${i}" class="${i === 0 ? "active" : ""}"><img src="${sprite(p.n)}" alt="">
        <div><div><b>${esc(p.de)}</b> <span class="en">${p.en !== p.de ? esc(p.en) : ""}</span></div>
        <div class="en">${pad(p.n)}${r ? " · " + esc(r.label) : " · fehlt noch"}</div></div>
        <span class="where">B${l.binder} · S. ${l.page} · ${slotText(l)}</span></li>`;
    }).join("");
    list.hidden = false;
  }
  function goTo(n) {
    const l = locate(n);
    state.binder = l.binder; state.page = l.page; state.view = "page";
    list.hidden = true; input.blur();
    render();
    const el = grid.querySelector(`.slot[data-n="${n}"]`);
    if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.classList.add("flash"); }
  }

  // ---------- Hash (Position merken) ----------
  function readHash() {
    const m = location.hash.match(/^#b([12])-s(\d+)(-ue)?$/);
    if (m) { state.binder = +m[1]; state.page = +m[2]; state.view = m[3] ? "overview" : "page"; }
  }
  function writeHash() {
    const h = `#b${state.binder}-s${state.page}${state.view === "overview" ? "-ue" : ""}`;
    if (location.hash !== h) { try { history.replaceState(null, "", h); } catch (e) { /* ignorieren */ } }
  }

  // ---------- Backup ----------
  async function exportBackup() {
    const data = { app: "pokebinder", version: 2, saved: new Date().toISOString(), collection: col };
    const json = JSON.stringify(data, null, 1);
    const filename = `binder-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (window.claude && typeof window.claude.use === "function") {
      const dl = await window.claude.use("downloads");
      if (!dl) { toast("Speichern als Datei ist hier nicht möglich."); return; }
      try { await dl.save({ filename, data: new Blob([json], { type: "application/json" }) }); toast("Backup gespeichert."); }
      catch (e) { if (e && e.code !== "declined") toast("Backup wurde nicht gespeichert."); }
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Backup gespeichert.");
  }
  function importBackup(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(fr.result);
        const c = data && data.collection;
        if (!c || typeof c !== "object") throw new Error();
        const clean = {};
        for (const k in c) { const e = cleanEntry(k, c[k]); if (e) clean[k] = e; }
        askConfirm(`Backup mit ${Object.keys(clean).length} Karten laden? Deine aktuellen Einträge werden ersetzt.`, async () => {
          const old = col; col = clean; render();
          const changed = new Set([...Object.keys(old), ...Object.keys(clean)]);
          for (const k of changed) await persist(+k);
          toast("Backup geladen.");
        });
      } catch (e) { toast("Die Datei ist kein gültiges Backup."); }
    };
    fr.readAsText(file);
  }
  function askConfirm(msg, onYes) {
    const box = $("#confirm");
    $("#confirmText").textContent = msg;
    box.hidden = false;
    $("#confirmYes").onclick = () => { box.hidden = true; onYes(); };
    $("#confirmNo").onclick = () => { box.hidden = true; };
  }
  let tt;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(tt); tt = setTimeout(() => (t.hidden = true), 2800);
  }

  // ---------- Statistik-Fenster ----------
  function openStats() { renderStats(); back.hidden = false; $("#statsModal").hidden = false; document.body.classList.add("modal-open"); }
  function closeStats() { $("#statsModal").hidden = true; if (picker.hidden) { back.hidden = true; document.body.classList.remove("modal-open"); } }

  // ---------- Events ----------
  document.querySelectorAll(".tab").forEach(b => b.onclick = () => { state.binder = +b.dataset.binder; state.page = 1; render(); });
  document.querySelectorAll(".view").forEach(b => b.onclick = () => { state.view = b.dataset.view; render(); });
  $("#filter").onchange = e => { state.filter = e.target.value; render(); };
  pageSel.onchange = () => { state.page = +pageSel.value; render(); };
  function step(d) {
    let { binder, page } = state;
    page += d;
    if (page < 1) { if (binder === 2) { binder = 1; page = pageCount(1); } else page = 1; }
    if (page > pageCount(binder)) { if (binder === 1) { binder = 2; page = 1; } else page = pageCount(2); }
    state.binder = binder; state.page = page; render();
  }
  $("#prev").onclick = () => step(-1);
  $("#next").onclick = () => step(1);

  grid.addEventListener("click", e => {
    const slot = e.target.closest(".slot[data-n]");
    if (slot && e.target.closest(".rbtn, .vis")) openPicker(+slot.dataset.n);
  });
  $("#pickerOpts").addEventListener("click", e => {
    const b = e.target.closest(".rchip");
    if (!b) return;
    pickR = b.dataset.r; renderSlotsOnly(); $("#designs").scrollTop = 0;
  });
  $("#designs").addEventListener("click", e => {
    const d = e.target.closest(".design");
    if (d && pickN && pickR) choose(d.dataset.card);
  });
  $("#btnNoDesign").onclick = () => { if (pickN && pickR) choose(""); };
  $("#btnClear").onclick = () => { if (!pickN) return; const n = pickN; delete col[n]; persist(n); closePicker(); render(); };
  $("#pickerNote").addEventListener("keydown", e => {
    if (e.key === "Enter" && pickN && col[pickN]) { const n = pickN; col[n].note = e.target.value.trim(); persist(n); closePicker(); render(); }
  });
  $("#pickerClose").onclick = closePicker;
  back.onclick = () => { closePicker(); closeStats(); };
  $("#btnStats").onclick = openStats;
  $("#statsClose").onclick = closeStats;
  document.addEventListener("click", e => { if (!e.target.closest(".search")) list.hidden = true; });
  $("#overView").addEventListener("click", e => {
    const m = e.target.closest(".mini");
    if (m) { state.page = +m.dataset.page; state.view = "page"; render(); scrollTo({ top: 0 }); }
  });

  input.addEventListener("input", showSuggest);
  input.addEventListener("focus", () => input.value && showSuggest());
  input.addEventListener("keydown", e => {
    const items = list.querySelectorAll("li[data-i]");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items.forEach((li, i) => li.classList.toggle("active", i === active));
    } else if (e.key === "Enter") {
      if (sugg[active]) goTo(sugg[active].n);
    } else if (e.key === "Escape") { list.hidden = true; }
  });
  list.addEventListener("click", e => {
    const li = e.target.closest("li[data-i]");
    if (li) goTo(sugg[+li.dataset.i].n);
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closePicker(); closeStats(); return; }
    if (e.target.matches("input, select, textarea") || !picker.hidden || !$("#statsModal").hidden) return;
    if (e.key === "ArrowLeft" && state.view === "page") step(-1);
    else if (e.key === "ArrowRight" && state.view === "page") step(1);
    else if (e.key === "/") { e.preventDefault(); input.focus(); }
  });

  $("#btnExport").onclick = exportBackup;
  $("#fileImport").onchange = e => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; };

  render();
  connectLive();
})();
