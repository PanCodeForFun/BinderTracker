"""Lädt deutsche Set-Daten und Kartenbilder von TCGdex nach sources/.

Aufruf (Python 3, Internet nötig):  python tools/download_german.py
Ablage:  sources/tcgdex-de/sets.json, sources/tcgdex-de/sets/<Set>.json,
         sources/images-de/<Set>/<Nummer>.webp, sources/logos-de/<Set>.webp (Set-Logos)
Vorhandene Dateien werden übersprungen, ein Abbruch ist also kein Problem.
Ist TCGdex nicht erreichbar, endet das Skript mit einem Fehler (Exit-Code 1).
"""
import json
import sys
import time

from common import ROOT, download_all, http_get, safe_name

SETS_DIR = ROOT / "sources" / "tcgdex-de"
IMAGES = ROOT / "sources" / "images-de"
LOGOS = ROOT / "sources" / "logos-de"
LOGOS_EN = ROOT / "sources" / "logos-en"  # englische TCGdex-Logos, gleiche Set-ids
DONE = SETS_DIR / "fertig2.txt"  # start.py erkennt daran einen vollständigen Download (2 = mit Logos)
API = "https://api.tcgdex.net/v2/de"
TRIES = 3


def cached_json(url, path):
    """JSON von url, beim ersten Mal unter path gespeichert."""
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(http_get(url, TRIES))
    return json.loads(path.read_text(encoding="utf-8"))


def collect_jobs(sets):
    """Bilder und Logos aller Sets. Ergebnis: Bild-Jobs, Logo-Jobs, {Set: Bild-Basis-URL}."""
    images, logos, bases = [], [], {}
    for i, s in enumerate(sets, 1):
        try:
            detail = cached_json(f"{API}/sets/{s['id']}", SETS_DIR / "sets" / f"{s['id']}.json")
        except Exception as e:
            print(f"Set {s['id']} übersprungen: {e}")
            continue
        cards = [c for c in detail.get("cards", []) if c.get("image")]
        if detail.get("logo"):  # Set-Logo (Booster-Bild-Ersatz in Kartenliste und Einkaufshilfe)
            logos.append((detail["logo"] + ".webp", LOGOS / f"{s['id']}.webp"))
        if cards:
            bases[s["id"]] = cards[-1]["image"].rsplit("/", 1)[0]  # für große Bilder (high.webp) online
            # englisches TCGdex-Logo als Ersatz; fehlt es, gibt's 404 und kein Bild
            logos.append((bases[s["id"]].replace("/de/", "/en/", 1) + "/logo.webp", LOGOS_EN / f"{s['id']}.webp"))
        images += [(c["image"] + "/low.webp", IMAGES / s["id"] / f"{safe_name(c['localId'])}.webp") for c in cards]
        if i % 5 == 0 or i == len(sets):
            print(f"Sets {i}/{len(sets)} …")
    return images, logos, bases


def write_available(bases):
    """sources/images-de/available.js: welche deutschen Bilder und Logos es lokal gibt (für js/data.js)."""
    stems = lambda d: sorted(p.stem for p in d.glob("*.webp")) if d.is_dir() else []
    js = lambda v: json.dumps(v, separators=(",", ":"))
    (IMAGES / "available.js").write_text(
        "window.LOCAL_IMAGES_DE = true;\n"
        f"window.TCGDEX_DE = {js(bases)};\n"
        f"window.LOCAL_LOGOS_DE = {js(stems(LOGOS))};\n"
        f"window.LOCAL_LOGOS_EN = {js(stems(LOGOS_EN))};\n", encoding="utf-8")


def main():
    try:
        sets = cached_json(f"{API}/sets", SETS_DIR / "sets.json")
    except Exception as e:
        sys.exit(f"FEHLER: TCGdex nicht erreichbar ({e}). Internetverbindung prüfen.")

    images, logos, bases = collect_jobs(sets)
    result = download_all(images, workers=8, label="Bilder", tries=TRIES)
    download_all(logos, workers=8, tries=TRIES, every=0)  # fehlende Logos sind normal, keine Fehler

    IMAGES.mkdir(parents=True, exist_ok=True)
    (IMAGES / "fehler.txt").write_text("\n".join(result.errors), encoding="utf-8")
    if result.all_failed():
        sys.exit("FEHLER: Keine Bilder geladen. Internetverbindung prüfen.")
    write_available(bases)
    DONE.write_text(time.strftime("%Y-%m-%d %H:%M"), encoding="utf-8")
    print(f"Fertig: {len(sets)} Sets, {len(images)} Bilder, {len(result.errors)} Fehler (siehe sources/images-de/fehler.txt).")


if __name__ == "__main__":
    main()
