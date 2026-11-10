// Filter über dem Binder: Knopf „Filter“ klappt die Auswahl auf, darunter die aktiven Filter als Chips.
// Was gefiltert wird, steht in js/filters.js.

const filterUi = { open: false };

const chipStyle = color => (color ? `style="--c:${color}"` : "");
const filterChip = (f, [value, label, color], on) =>
  `<button class="chip${on ? " on" : ""}" data-f="${f.id}" data-v="${esc(value)}" aria-pressed="${on}" ${chipStyle(color)}>${esc(label)}</button>`;

function filterGroupHtml(f) {
  const options = f.options();
  const chips = options.length ? options.map(o => filterChip(f, o, chosen(f.id).includes(o[0]))).join("") : `<span class="sub">${t("fEmpty")}</span>`;
  return `<section class="fgroup"><h3>${t(f.label)}</h3><div class="chips">${chips}</div></section>`;
}

// Aktive Filter als Chips mit ✕. Gewählte Werte ohne passende Auswahl (z. B. nach neuen Daten) zeigen den Rohwert.
function activeChipsHtml() {
  return activeFilters().flatMap(f => {
    const labels = new Map(f.options().map(([v, label, color]) => [v, [label, color]]));
    return chosen(f.id).map(v => {
      const [label, color] = labels.get(v) || [v];
      return `<button class="chip on" data-f="${f.id}" data-v="${esc(v)}" title="${t("fRemove")}" ${chipStyle(color)}>${esc(t(f.label))}: ${esc(label)} ✕</button>`;
    });
  }).join("");
}

function renderFilters() {
  const count = activeCount();
  $("#filterNum").textContent = count ? `(${count})` : "";
  $("#btnFilter").classList.toggle("on", filterUi.open);
  $("#btnFilter").setAttribute("aria-expanded", filterUi.open);
  $("#filterPanel").hidden = !filterUi.open;
  if (filterUi.open) {
    $("#filterPanel").innerHTML = `<div class="fp-head">
        <span class="sub">${t("fHint")}</span>
        <button class="ghost" data-freset${count ? "" : " disabled"}>${t("fReset")}</button>
      </div>${FILTERS.map(filterGroupHtml).join("")}`;
  }
  $("#filterChips").hidden = !count;
  $("#filterChips").innerHTML = count ? `${activeChipsHtml()}<button class="chip-clear" data-freset>${t("fReset")}</button>` : "";
}

// „12 von 640 passen“ für den Kopf der Binderseite, nur wenn etwas gefiltert wird.
function matchText(binder) {
  if (!anyFilter()) return "";
  const active = activeFilters(), all = dexInBinder(binder);
  return t("fMatch", { a: all.filter(p => matches(p.n, active)).length, b: all.length });
}

function bindFilterEvents() {
  on("#btnFilter", "click", () => { filterUi.open = !filterUi.open; renderFilters(); });
  onClosest("#binderFilters", "click", "[data-f]", el => { toggleFilter(el.dataset.f, el.dataset.v); render(); });
  onClosest("#binderFilters", "click", "[data-freset]", () => { resetFilters(); render(); });
}
