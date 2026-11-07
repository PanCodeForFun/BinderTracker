"""Lädt die Kartenbilder nach images/, damit die App sie ohne Internet zeigt.

Aufruf (Python 3, Internet nötig):
  python tools/download_images.py                     alle Karten (~17.400 Bilder)
  python tools/download_images.py binder-backup.json  nur Karten aus einem Backup

Bereits vorhandene Bilder werden übersprungen, ein Abbruch ist also kein Problem.
"""
import json
import pathlib
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "images"
IMG_HOST = "https://images.pokemontcg.io/"


def read_js_var(text, name):
    line = next(l for l in text.splitlines() if l.startswith(f"window.{name} = "))
    return json.loads(line.split(" = ", 1)[1].rstrip(";"))


def all_cards():
    """(Karten-id, Bild-URL, lokaler Pfad) wie in js/data.js."""
    text = (ROOT / "data" / "cards.js").read_text(encoding="utf-8")
    sets = read_js_var(text, "TCG_SETS")
    for cards in read_js_var(text, "TCG_CARDS").values():
        for set_idx, num, _cat, _name, _rarity, *img in cards:
            set_id = sets[set_idx][0]
            path = img[0] if img else f"{set_id}/{num}.png"
            url = path if path.startswith("http") else IMG_HOST + path
            local = IMAGES / set_id / (re.sub(r"[^A-Za-z0-9_-]", "_", num) + ".png")
            yield f"{set_id}-{num}", url, local


def download(job):
    _id, url, local = job
    if local.exists():
        return "da"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BinderTracker"})
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        local.parent.mkdir(parents=True, exist_ok=True)
        local.write_bytes(data)
        return "neu"
    except Exception as e:
        return f"Fehler {url}: {e}"


def main():
    jobs = {card_id: (card_id, url, local) for card_id, url, local in all_cards()}
    if len(sys.argv) > 1:
        owned = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))["collection"]
        wanted = {e["card"] for e in owned.values() if e.get("card")}
        jobs = {k: v for k, v in jobs.items() if k in wanted}

    counts = {"da": 0, "neu": 0, "Fehler": 0}
    with ThreadPoolExecutor(16) as pool:
        for i, result in enumerate(pool.map(download, jobs.values()), 1):
            key = result if result in counts else "Fehler"
            counts[key] += 1
            if key == "Fehler":
                print(result)
            if i % 100 == 0:
                print(f"{i}/{len(jobs)} …")

    if jobs and counts["Fehler"] == len(jobs):
        sys.exit("FEHLER: Keine Bilder geladen. Internetverbindung prüfen.")
    IMAGES.mkdir(exist_ok=True)
    (IMAGES / "available.js").write_text("window.LOCAL_IMAGES = true;\n", encoding="utf-8")
    print(f"Fertig: {counts['neu']} neu, {counts['da']} schon vorhanden, {counts['Fehler']} Fehler.")


if __name__ == "__main__":
    main()
