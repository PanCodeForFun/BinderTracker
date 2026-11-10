// Bereich Binder: Binderseite mit 16 Slots, Menü „…“ am Slot, Übersicht aller Seiten, Blättern.

// ---------- Slot ----------
function slotHtml(n) {
  const p = BY_N.get(n), loc = locate(n);
  const corner = `<span class="pos">${loc.row}/${loc.col}</span><span class="num">${pad(n)}</span>`;
  if (!p) return `<div class="slot future">${corner}<div class="free">${t("freeSlot")}</div></div>`;

  const e = owned(n), r = e && RARITY[e.r], card = e && findCard(n, e.card);
  const dim = anyFilter() && !matches(n);
  const lang = e && cardLang(e);
  const visual = card ? cardImage(card, spriteImg(n), lang) : spriteImg(n);
  const tag = e && lang !== DEFAULT_CARD_LANG ? ` <span class="lang-tag" title="${esc(CARD_LANG[lang].label)}">${CARD_LANG[lang].short}</span>` : "";
  const up = wantsUpgrade(e) ? ` <span class="up-tag" title="${t("upTag")}">↑</span>` : "";
  const sub = card ? `${card.set} · ${card.num}` : p.alt !== p.name ? p.alt : "";

  return `<div class="slot${e ? " have" : ""}${dim ? " dim" : ""}" data-n="${n}" ${colorStyle(r)}>
    ${corner}
    <div class="vis">${visual}</div>
    <div class="de">${esc(p.name)}${tag}${up}</div>
    <div class="sub">${esc(sub) || "&nbsp;"}</div>
    <div class="slot-foot">
      <button class="rbtn">${r ? esc(r.label) : t("pickCard")}</button>
      ${e ? `<button class="more" title="${t("moreTip")}" aria-label="${t("moreTip")}">…</button>` : ""}
    </div>
  </div>`;
}

// ---------- Menü „…“ am Slot: versteckte Zusatzfunktionen pro Karte ----------
// Neue Funktion = neuer Eintrag: html(entry) zeichnet sie, click(element, entry) gibt den
// geänderten Eintrag zurück (oder nichts). Gespeichert wird über saveEntry, also mit Rückgängig.
const SLOT_MENU = [
  {  // Sprache der Karte: DE (Standard), EN, JP
    html: e => `<div class="sm-title">${t("cardLang")}</div><div class="seg">${CARD_LANGS.map(l =>
      `<button data-lang="${l.id}" class="${cardLang(e) === l.id ? "on" : ""}" title="${esc(l.label)}">${l.short}</button>`).join("")}</div>`,
    click: (el, e) => el.dataset.lang && { ...e, lang: el.dataset.lang },
  },
  {  // Upgrade gesucht: unter UPGRADE_BELOW automatisch, darüber von Hand
    html: e => `<div class="sm-title">${t("upgrades")}</div>${autoUpgrade(e)
      ? `<div class="sm-note">↑ ${t("upAuto", { x: TIER[UPGRADE_BELOW].label })}</div>`
      : `<button data-up class="sm-toggle${e.up ? " on" : ""}" aria-pressed="${!!e.up}">↑ ${t("upToggle")}</button>`}`,
    click: (el, e) => "up" in el.dataset && { ...e, up: !e.up },
  },
];
const slotMenu = { n: null };

function openSlotMenu(n, btn) {
  const e = owned(n);
  if (!e) return;
  slotMenu.n = n;
  const menu = $("#slotMenu");
  menu.innerHTML = SLOT_MENU.map((item, i) => `<div class="sm-item" data-item="${i}">${item.html(e)}</div>`).join("");
  menu.hidden = false;
  // unter dem Knopf, rechtsbündig; passt es unten nicht, darüber
  const b = btn.getBoundingClientRect(), m = menu.getBoundingClientRect();
  const top = b.bottom + 6 + m.height > innerHeight ? b.top - 6 - m.height : b.bottom + 6;
  menu.style.top = `${Math.max(8, top)}px`;
  menu.style.left = `${Math.min(Math.max(8, b.right - m.width), innerWidth - m.width - 8)}px`;
  menu.querySelector("button")?.focus({ preventScroll: true });
}

// true, wenn es offen war.
function closeSlotMenu() {
  if ($("#slotMenu").hidden) return false;
  $("#slotMenu").hidden = true;
  slotMenu.n = null;
  return true;
}

async function slotMenuClick(el) {
  const n = slotMenu.n, item = SLOT_MENU[+el.closest(".sm-item").dataset.item];
  const next = item?.click(el, owned(n));
  if (!next) return;
  closeSlotMenu();
  const done = saveEntry(n, cleanEntry(n, next));
  render();
  await saved(done);
}

// ---------- Seite und Übersicht ----------
function renderPage() {
  const start = firstOnPage(view.binder, view.page);
  $("#pageTitle").textContent = t("pageTitle", { b: view.binder, p: view.page });
  $("#pageRange").textContent = t("range", { a: pad(start), b: pad(Math.min(start + LAYOUT.slotsPerPage - 1, Math.max(start, MAX_N))) });
  $("#pageProgress").textContent = [
    t("inBinder", { a: ownedCount(p => inBinder(view.binder, p.n)), b: dexInBinder(view.binder).length }),
    matchText(view.binder),
  ].filter(Boolean).join(" · ");
  $("#grid").innerHTML = pageNumbers(view.binder, view.page).map(slotHtml).join("");
}

function renderOverview() {
  const filtered = anyFilter(), active = activeFilters();
  const head = filtered ? `<p class="sub overview-match">${matchText(view.binder)}</p>` : "";
  $("#overView").innerHTML = head + range(pageCount(view.binder), 1).map(page => {
    const numbers = pageNumbers(view.binder, page);
    const cells = numbers.map(n => {
      const p = BY_N.get(n), r = RARITY[owned(n)?.r];
      const cls = [!p ? "void" : r ? "have" : "", p && filtered && !matches(n, active) ? "dim" : ""].filter(Boolean).join(" ");
      return `<span class="${cls}" ${colorStyle(r)} title="${p ? esc(pad(n) + " " + p.name) : t("free")}"></span>`;
    });
    const have = numbers.filter(owned).length, real = numbers.filter(n => BY_N.has(n)).length;
    return `<button class="mini" data-page="${page}"><div class="t"><b>${t("page")} ${page}</b><span>${have}/${real}</span></div><div class="g">${cells.join("")}</div></button>`;
  }).join("");
}

// Leiste über dem Binder: Binder-Reiter, Seite/Übersicht, Seitenauswahl.
function renderBinderBar() {
  const pages = pageCount(view.binder);
  view.page = Math.min(Math.max(1, view.page), pages);
  markOn(".tab", "binder", view.binder);
  markOn(".view", "view", view.mode);
  $("#pageSelect").innerHTML = range(pages, 1).map(i => `<option>${i}</option>`).join("");
  $("#pageSelect").value = view.page;
  $("#pageCount").textContent = t("of", { n: pages });
  $("#prev").disabled = view.binder === 1 && view.page === 1;
  $("#next").disabled = view.binder === 2 && view.page === pages;
}

// Blättern über die Bindergrenze hinweg: hinter der letzten Seite von Binder 1 kommt Binder 2.
function turnPage(delta) {
  let { binder, page } = view;
  page += delta;
  if (page < 1) [binder, page] = binder === 2 ? [1, pageCount(1)] : [1, 1];
  else if (page > pageCount(binder)) [binder, page] = binder === 1 ? [2, 1] : [2, pageCount(2)];
  Object.assign(view, { binder, page });
  render();
}

const slotEl = n => $(`.slot[data-n="${n}"]`);

// Zur Seite mit dieser Dex-Nummer, der Slot blinkt kurz.
function goTo(n) {
  const { binder, page } = locate(n);
  Object.assign(view, { binder, page, mode: "page" });
  render();
  const el = slotEl(n);
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
  el?.classList.add("flash");
}

function bindBinderEvents() {
  onEach(".tab", b => { Object.assign(view, { binder: +b.dataset.binder, page: 1 }); render(); });
  onEach(".view", b => { view.mode = b.dataset.view; render(); });
  on("#filter", "change", e => { view.filter = e.target.value; render(); });
  on("#pageSelect", "change", e => { view.page = +e.target.value; render(); });
  on("#prev", "click", () => turnPage(-1));
  on("#next", "click", () => turnPage(1));
  onClosest("#overView", "click", ".mini", m => { Object.assign(view, { page: +m.dataset.page, mode: "page" }); render(); scrollTo({ top: 0 }); });

  onClosest("#grid", "click", ".slot[data-n]", (slot, e) => {
    const n = +slot.dataset.n, more = e.target.closest(".more");
    if (more) return slotMenu.n === n ? closeSlotMenu() : openSlotMenu(n, more);
    if (e.target.closest(".rbtn, .vis")) openPicker(n);
  });
  onClosest("#slotMenu", "click", "button", slotMenuClick);
  on(document, "click", e => { if (!e.target.closest("#slotMenu, .more")) closeSlotMenu(); });
  on(window, "resize", closeSlotMenu);
  on(window, "scroll", closeSlotMenu, { passive: true });
}
