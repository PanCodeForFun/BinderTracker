// Kartenauswahl (Fenster über dem Binder): alle Karten eines Pokémon nach Stufe, ★ für die
// Wunschliste, „Reverse“ für Reverse Holo, „Ohne Design“ und „Slot leeren“.

const pick = { n: null, adding: false };  // Dex-Nummer, für die das Fenster offen ist; adding: Karte für Binder 4 suchen

function showPicker() {
  $("#picker").hidden = false;
  $("#modalBack").hidden = false;
  document.body.classList.add("modal-open");
  $("#designs").scrollTop = 0;
}

function openPicker(n) {
  const p = BY_N.get(n), e = owned(n);
  pick.n = n;
  pick.adding = false;
  $("#picker").classList.remove("adding");
  $("#pickerTitle").textContent = `${pad(n)} ${p.name}`;
  $("#pickerSub").textContent = `${p.alt !== p.name ? p.alt + " · " : ""}${t("cardsKnown", { n: cardsFor(n).length })}`;
  $("#pickerSprite").src = spriteUrl(n);
  $("#pickerNote").value = e?.note || "";
  $("#noDesignRarity").value = e?.r || "normal";
  const card = findCard(n, e?.card);
  $("#pickerPrice").textContent = "";
  if (card) showPrice($("#pickerPrice"), card, e.r === "reverse");
  renderPicker();
  showPicker();
}

// ---------- Binder 4 „Sonstiges“: Karte hinzufügen ----------
// Erst den Namen suchen (Trainer, Items, Stadien …), dann wie gewohnt die Karte wählen.
function openAdd() {
  Object.assign(pick, { n: null, adding: true });
  $("#picker").classList.add("adding");
  $("#pickerTitle").textContent = t("addCard");
  $("#pickerSub").textContent = t("addHint");
  $("#pickerSprite").src = TRAINER_ICON;
  $("#pickerPrice").textContent = "";
  $("#designs").innerHTML = `<input id="addQuery" class="add-query" type="search" placeholder="${esc(t("addPh"))}" autocomplete="off"><ul id="addHits" class="add-hits"></ul>`;
  renderAddHits();
  showPicker();
  $("#addQuery").focus();
}

function renderAddHits() {
  const k = norm($("#addQuery").value);
  const hits = k ? TRAINERS.filter(p => norm(p.de).includes(k) || norm(p.en).includes(k)).slice(0, 60) : [];
  $("#addHits").innerHTML = !k ? `<li class="sub">${t("addEmpty")}</li>` : !hits.length ? `<li class="sub">${t("nothingFound")}</li>` : hits.map(p => {
    const r = RARITY[owned(p.n)?.r], type = TRAINER_TYPE[p.trainerType];
    return `<li><button data-n="${p.n}" ${colorStyle(r)}><b>${esc(p.name)}</b> <span class="sub">${p.alt !== p.name ? esc(p.alt) + " · " : ""}${
      type ? esc(localName(type.de, type.en)) + " · " : ""}${t("cardsKnown", { n: cardsFor(p.n).length })}</span>${
      r ? `<span class="add-have">${esc(r.label)} · ${t("inBinderTag")}</span>` : ""}</button></li>`;
  }).join("");
}

function closePicker() {
  $("#picker").hidden = true;
  $("#modalBack").hidden = true;
  document.body.classList.remove("modal-open");
  Object.assign(pick, { n: null, adding: false });
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
    const wished = isWished(c.id), chosen = e?.card === c.id;
    return `${head}<button class="design${chosen ? " sel" : ""}${wished ? " wished" : ""}" data-card="${esc(c.id)}" ${colorStyle(tier)}>
      <span class="star" data-star role="button" title="${t(wished ? "wishRemove" : "wishAdd")}" aria-pressed="${wished}">★</span>
      <div class="dhead"><span class="sym">${symbolFor(c.rarity)}</span><span class="rname">${esc(c.rarity === "None" ? t("noRarity") : c.rarity)}</span>${
        REVERSE_FROM.includes(c.cat) ? `<span class="rev${chosen && e.r === "reverse" ? " on" : ""}" data-rev title="${t("reverseTip")}">Reverse</span>` : ""}</div>
      ${cardImage(c, `<span>${esc(c.name)}</span>`)}
      <div class="dmeta"><b>${esc(c.set)}</b><span>${esc(c.num)}/${esc(c.total)} · ${esc(c.year)}</span></div>
    </button>`;
  }).join("");
}

// Eintrag für den offenen Slot speichern (null = leeren). Die Kartensprache bleibt beim Kartenwechsel,
// eine erfüllte Wunschkarte fliegt von der Wunschliste (beides ein Rückgängig-Schritt).
async function commit(entry) {
  const n = pick.n, before = owned(n), prev = RARITY[before?.r];
  if (entry && before?.lang && !entry.lang) entry = { ...entry, lang: before.lang };
  // Binder 4: neue Karten kommen hinten dran, beim Kartenwechsel bleibt der Platz
  if (entry && TRAINER_INDEX.has(n)) entry = { ...entry, at: before?.at || Date.now() };
  if (entry && prev && RARITY[entry.r].rank < prev.rank) toast(t("rarerHint", { a: prev.label, b: RARITY[entry.r].label }));
  closePicker();
  let done;
  asStep("", () => {
    if (entry?.card && isWished(entry.card)) saved(setWish(entry.card, false));
    done = saveEntry(n, entry);
  });
  render();
  await saved(done);
}

const pickerNote = () => $("#pickerNote").value.trim();

// Klick auf die Karte wählt sie, Klick auf „Reverse“ wählt sie als Reverse Holo.
function choose(cardId, asReverse) {
  const card = findCard(pick.n, cardId);
  commit({ r: asReverse ? "reverse" : card.cat, card: card.id, note: pickerNote() });
}

function bindPickerEvents() {
  $("#noDesignRarity").innerHTML = optionsHtml(RARITIES.map(r => [r.id, r.label]));
  on("#designs", "input", e => { if (e.target.id === "addQuery") renderAddHits(); });
  on("#designs", "keydown", e => { if (e.target.id === "addQuery" && e.key === "Enter") $("#addHits button")?.click(); });
  onClosest("#designs", "click", "#addHits button[data-n]", b => openPicker(+b.dataset.n));
  onClosest("#designs", "click", ".design", (d, e) => {
    if (!e.target.closest("[data-star]")) return choose(d.dataset.card, !!e.target.closest("[data-rev]"));
    saved(setWish(d.dataset.card, !isWished(d.dataset.card)));
    const top = $("#designs").scrollTop;
    renderPicker();
    $("#designs").scrollTop = top;
  });
  on("#btnNoDesign", "click", () => commit({ r: $("#noDesignRarity").value, card: "", note: pickerNote() }));
  on("#btnClear", "click", () => commit(null));
  on("#pickerNote", "keydown", e => { if (e.key === "Enter" && owned(pick.n)) commit({ ...owned(pick.n), note: pickerNote() }); });
  onEach("#picker .x, #modalBack", closePicker);
}
