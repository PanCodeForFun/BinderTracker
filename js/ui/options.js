// Bereich Optionen: Sprache, Backup (JSON speichern/laden, CSV für Excel), Speicherort.

// Datei speichern und das Ergebnis melden. Bricht man den Dialog auf claude.ai ab, kommt kein Hinweis.
async function exportFile(filename, text, type, okKey, failKey) {
  try {
    await saveFile(filename, text, type);
    toast(t(okKey));
  } catch (err) {
    if (err?.code !== "declined") toast(t(failKey));
  }
}

// Backup (JSON oder CSV) einlesen und nach Rückfrage Sammlung und Wunschliste ersetzen (ein Rückgängig-Schritt).
async function importBackup(file) {
  let next;
  try { next = parseBackup(await file.text()); } catch { return toast(t("backupInvalid")); }
  askConfirm(t("backupAsk", { n: Object.keys(next.collection).length }), async () => {
    await asStep(t("backupStep"), async () => {
      await saved(replaceCollection(next.collection));
      if (next.wishlist) await saved(replaceWishlist(next.wishlist));
    });
    render();
    toast(t("backupLoaded"));
  });
}

function bindOptionEvents() {
  $("#lang").innerHTML = optionsHtml(LANGS.map(l => [l.id, l.label, l.disabled]), LANG);
  on("#lang", "change", e => setLang(e.target.value));
  on("#btnExport", "click", () => exportFile(`binder-backup-${today()}.json`, backupJson(), "application/json", "backupSaved", "backupNotSaved"));
  on("#btnCsv", "click", () => exportFile(`binder-${today()}.csv`, backupCsv(), "text/csv;charset=utf-8", "csvSaved", "csvNotSaved"));
  on("#fileImport", "change", e => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) importBackup(file);
  });
}
