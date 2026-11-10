// Bausteine, die alle Bereiche der Oberfläche nutzen: Zustand der Ansicht, Hinweise,
// Kartenbilder, Vollansicht, Preise, Bestätigen.

// Welcher Bereich und welche Binderseite gerade zu sehen ist (siehe VIEWS in js/main.js).
// filter: Auswahl „Anzeigen“, filters: gewählte Werte je Filter (js/filters.js), bleiben gespeichert.
const view = { binder: 1, page: 1, mode: "page", filter: "all", filters: readJson(FILTER_KEY, {}) };

const colorStyle = r => (r ? `style="--r:${r.color};--rInk:${r.ink}"` : "");
const spriteImg = n => `<img class="spr" src="${spriteUrl(n)}" alt="">`;

// ---------- Hinweise und Status ----------
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 2800);
}

function setStatus(kind, text) {
  $("#status").className = "status " + kind;
  $("#status").textContent = text;
  $("#statusText").textContent = text;
}

// Wartet auf das Online-Speichern. Ein Fehler erscheint nur in der Statusanzeige.
const saved = job => Promise.resolve(job).catch(() => setStatus("err", t("saveFailed")));

function askConfirm(msg, onYes) {
  $("#confirmText").textContent = msg;
  $("#confirm").hidden = false;
  $("#confirmYes").onclick = () => { $("#confirm").hidden = true; onYes(); };
  $("#confirmNo").onclick = () => ($("#confirm").hidden = true);
}

// ---------- Bilder ----------
// Bild mit Ersatzquellen: srcs der Reihe nach (cardImageFailed), zuletzt verschwindet es.
function imgChain(srcs, attrs = "") {
  const [src, ...rest] = srcs;
  return `<img src="${esc(src)}" data-fallback="${esc(rest.join("|"))}" ${attrs} loading="lazy" onerror="cardImageFailed(this)">`;
}

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

// Kartenbild (Quellen siehe imageSources in js/data.js). Ohne Bild bleibt eine Textkarte mit Set und Nummer.
// lang: Bild in dieser Kartensprache bevorzugen (ohne eigene Bilder, z. B. JP: Sprache der App).
function cardImage(card, extra = "", lang) {
  return `<div class="cardbox">
    ${imgChain(card.srcsBy?.[lang] || card.srcs, `alt="${esc(card.name)}"`)}
    <div class="textcard">${extra}<b>${esc(card.set)}</b><span>${esc(card.num)}/${esc(card.total)}</span></div>
  </div>`;
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

// true, wenn sie offen war.
function closeZoom(viaHistory = false) {
  if ($("#zoom").hidden) return false;
  $("#zoom").hidden = true;
  document.body.classList.remove("modal-open");
  if (!viaHistory && history.state?.zoom) history.back();
  return true;
}

// ---------- Preise (js/prices.js) ----------
// Preis in ein Element schreiben (Kartenauswahl, Vollansicht). Holt ihn bei Bedarf.
async function showPrice(el, card, reverse = false) {
  if (!el || !card) return;
  const text = () => {
    const v = cardValue(card, reverse);
    return v == null ? t("noPrice") : t("approx", { v: euro(v) });
  };
  el.textContent = hasFreshPrice(card) ? text() : t("priceLoading");
  try { await priceFor(card); el.textContent = text(); } catch { el.textContent = t("priceFailed"); }
}

// ---------- Statistik-Kacheln ----------
const statTile = (big, label, extra = "") => `<div class="stat"><div class="big">${big}</div><div class="lbl">${label}</div>${extra}</div>`;
const progressBar = (a, b) => `<div class="progress"><span style="width:${pct(a, b)}%"></span></div>`;
const progressTile = (label, have, total) =>
  statTile(`${have} / ${total}`, `${label} (${pct(have, total)} %)`, `\n    ${progressBar(have, total)}`);
