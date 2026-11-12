"""Lädt die Kartenbilder nach images/, damit die App sie ohne Internet zeigt.

Aufruf (Python 3, Internet nötig):
  python tools/download_images.py                     alle Karten (~20.700 Bilder, mit Trainern)
  python tools/download_images.py binder-backup.json  nur Karten aus einem Backup

Bereits vorhandene Bilder werden übersprungen, ein Abbruch ist also kein Problem.
"""
import json
import pathlib
import sys

from common import ROOT, download_all, read_js_vars, safe_name

IMAGES = ROOT / "images"
IMG_HOST = "https://images.pokemontcg.io/"


def image_jobs():
    """{Karten-id oder logo-<Set>: (Bild-URL, lokaler Pfad)}, Pfade wie in js/data.js."""
    data = read_js_vars("cards.js")
    sets = data["TCG_SETS"]
    jobs = {}
    for cards in [*data["TCG_CARDS"].values(), data.get("TCG_TRAINERS", [])]:
        for set_idx, num, _cat, _name, _rarity, *img in cards:
            set_id = sets[set_idx][0]
            path = img[0] if img and img[0] else f"{set_id}/{num}.png"
            url = path if path.startswith("http") else IMG_HOST + path
            jobs[f"{set_id}-{num}"] = (url, IMAGES / set_id / f"{safe_name(num)}.png")
    for set_id, *_ in sets:  # Set-Logos
        jobs[f"logo-{set_id}"] = (f"{IMG_HOST}{set_id}/logo.png", IMAGES / "logos" / f"{set_id}.png")
    return jobs


def main():
    jobs = image_jobs()
    if len(sys.argv) > 1:  # nur Karten aus einem Backup
        owned = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))["collection"]
        wanted = {e["card"] for e in owned.values() if e.get("card")}
        jobs = {k: v for k, v in jobs.items() if k in wanted}

    result = download_all(jobs.values(), workers=16, print_errors=True)
    if result.all_failed():
        sys.exit("FEHLER: Keine Bilder geladen. Internetverbindung prüfen.")
    IMAGES.mkdir(exist_ok=True)
    (IMAGES / "available.js").write_text("window.LOCAL_IMAGES = true;\n", encoding="utf-8")
    print(f"Fertig: {result.new} neu, {result.present} schon vorhanden, {len(result.errors)} Fehler.")


if __name__ == "__main__":
    main()
