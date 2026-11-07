"""Lädt deutsche Set-Daten und Kartenbilder von TCGdex nach sources/.

Aufruf (Python 3, Internet nötig):  python tools/download_german.py
Ablage:  sources/tcgdex-de/sets.json, sources/tcgdex-de/sets/<Set>.json,
         sources/images-de/<Set>/<Nummer>.webp, sources/logos-de/<Set>.webp (Set-Logos)
Vorhandene Dateien werden übersprungen, ein Abbruch ist also kein Problem.
Ist TCGdex nicht erreichbar, endet das Skript mit einem Fehler (Exit-Code 1).
"""
import json
import pathlib
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "sources" / "tcgdex-de"
IMAGES = ROOT / "sources" / "images-de"
LOGOS = ROOT / "sources" / "logos-de"
LOGOS_EN = ROOT / "sources" / "logos-en"  # englische TCGdex-Logos, gleiche Set-ids
DONE = DATA / "fertig2.txt"  # start.py erkennt daran einen vollständigen Download (2 = mit Logos)
API = "https://api.tcgdex.net/v2/de"


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "BinderTracker"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 ** i)


def cached_json(url, path):
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(get(url))
    return json.loads(path.read_text(encoding="utf-8"))


def download_image(job):
    url, local = job
    if local.exists():
        return None
    try:
        data = get(url)
    except Exception as e:
        return f"{url}: {e}"
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_bytes(data)
    return None


def main():
    try:
        sets = cached_json(f"{API}/sets", DATA / "sets.json")
    except Exception as e:
        sys.exit(f"FEHLER: TCGdex nicht erreichbar ({e}). Internetverbindung prüfen.")

    jobs, logo_jobs, bases = [], [], {}
    for i, s in enumerate(sets, 1):
        try:
            detail = cached_json(f"{API}/sets/{s['id']}", DATA / "sets" / f"{s['id']}.json")
        except Exception as e:
            print(f"Set {s['id']} übersprungen: {e}")
            continue
        if detail.get("logo"):  # Set-Logo (Booster-Bild-Ersatz in Kartenliste und Einkaufshilfe)
            logo_jobs.append((detail["logo"] + ".webp", LOGOS / f"{s['id']}.webp"))
        for c in detail.get("cards", []):
            if c.get("image"):
                bases[s["id"]] = c["image"].rsplit("/", 1)[0]  # für große Bilder (high.webp) online
        if s["id"] in bases:  # englisches TCGdex-Logo als Ersatz; fehlt es, gibt's 404 und kein Bild
            en_base = bases[s["id"]].replace("/de/", "/en/", 1)
            logo_jobs.append((en_base + "/logo.webp", LOGOS_EN / f"{s['id']}.webp"))
        for c in detail.get("cards", []):
            if c.get("image"):
                name = re.sub(r"[^A-Za-z0-9_-]", "_", c["localId"]) + ".webp"
                jobs.append((c["image"] + "/low.webp", IMAGES / s["id"] / name))
        if i % 5 == 0 or i == len(sets):
            print(f"Sets {i}/{len(sets)} …")

    failed = []
    with ThreadPoolExecutor(8) as pool:
        for i, err in enumerate(pool.map(download_image, jobs), 1):
            if err:
                failed.append(err)
            if i % 100 == 0 or i == len(jobs):
                print(f"Bilder {i}/{len(jobs)} …")
    with ThreadPoolExecutor(8) as pool:  # Logos: fehlende sind normal, keine Fehler
        list(pool.map(download_image, logo_jobs))

    IMAGES.mkdir(parents=True, exist_ok=True)
    (IMAGES / "fehler.txt").write_text("\n".join(failed), encoding="utf-8")
    if jobs and len(failed) == len(jobs):
        sys.exit("FEHLER: Keine Bilder geladen. Internetverbindung prüfen.")
    stems = lambda d: sorted(p.stem for p in d.glob("*.webp")) if d.is_dir() else []
    js = lambda v: json.dumps(v, separators=(",", ":"))
    (IMAGES / "available.js").write_text(  # für js/data.js
        "window.LOCAL_IMAGES_DE = true;\n"
        f"window.TCGDEX_DE = {js(bases)};\n"
        f"window.LOCAL_LOGOS_DE = {js(stems(LOGOS))};\n"
        f"window.LOCAL_LOGOS_EN = {js(stems(LOGOS_EN))};\n", encoding="utf-8")
    DONE.write_text(time.strftime("%Y-%m-%d %H:%M"), encoding="utf-8")
    print(f"Fertig: {len(sets)} Sets, {len(jobs)} Bilder, {len(failed)} Fehler (siehe sources/images-de/fehler.txt).")


if __name__ == "__main__":
    main()
