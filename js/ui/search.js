// Pokémon-Suche über dem Binder: Vorschläge beim Tippen, Pfeiltasten und Enter springen zum Slot.

const suggest = { hits: [], active: 0 };

function renderSuggest() {
  const q = $("#search").value;
  suggest.hits = search(q);
  suggest.active = 0;
  $("#suggest").hidden = !q.trim();
  $("#suggest").innerHTML = !suggest.hits.length ? `<li class="none">${t("nothingFound")}</li>` : suggest.hits.map((p, i) => {
    const r = RARITY[owned(p.n)?.r];
    return `<li data-i="${i}" class="${i ? "" : "active"}"><img src="${spriteUrl(p.n)}" alt="">
      <div><div><b>${esc(p.name)}</b> <span class="en">${p.alt !== p.name ? esc(p.alt) : ""}</span></div>
      <div class="en">${pad(p.n)} · ${r ? esc(r.label) : t("missingYet")}</div></div>
      <span class="where">${whereText(p.n)}</span></li>`;
  }).join("");
}

function pickSuggestion(i) {
  const p = suggest.hits[i];
  if (!p) return;
  $("#suggest").hidden = true;
  $("#search").blur();
  goTo(p.n);
}

function moveSuggestion(delta) {
  const items = $$("#suggest li[data-i]");
  if (!items.length) return;
  suggest.active = (suggest.active + delta + items.length) % items.length;
  items.forEach((li, i) => li.classList.toggle("active", i === suggest.active));
}

function bindSearchEvents() {
  on("#search", "input", renderSuggest);
  on("#search", "focus", e => e.target.value && renderSuggest());
  on("#search", "keydown", e => {
    if (e.key === "Enter") pickSuggestion(suggest.active);
    else if (e.key === "Escape") $("#suggest").hidden = true;
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); moveSuggestion(e.key === "ArrowDown" ? 1 : -1); }
  });
  onClosest("#suggest", "click", "li[data-i]", li => pickSuggestion(+li.dataset.i));
  on(document, "click", e => { if (!e.target.closest(".search")) $("#suggest").hidden = true; });
}
