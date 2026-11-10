"""Gemeinsame Helfer für die Skripte in tools/: Pfade, Herunterladen, data/*.js lesen."""
import json
import pathlib
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
USER_AGENT = "BinderTracker"


def http_get(url, tries=1, timeout=30):
    """Lädt eine URL. Bei tries > 1 mit Wartezeit (1 s, 2 s, …) zwischen den Versuchen."""
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 ** i)


def safe_name(s):
    """Dateiname aus einer Kartennummer, wie safeName in js/data.js."""
    return re.sub(r"[^A-Za-z0-9_-]", "_", s)


def read_js_vars(name):
    """Liest die Variablen einer von build_data.py erzeugten Datei, z. B. read_js_vars("cards.js")["TCG_SETS"]."""
    found = {}
    for line in (DATA / name).read_text(encoding="utf-8").splitlines():
        m = re.match(r"window\.(\w+) = (.*);$", line)
        if m:
            found[m[1]] = json.loads(m[2])
    return found


def download_file(url, local, tries=1):
    """Lädt url nach local, wenn es die Datei noch nicht gibt.
    Ergebnis: "da" (schon vorhanden), "neu" oder eine Fehlermeldung."""
    if local.exists():
        return "da"
    try:
        data = http_get(url, tries)
    except Exception as e:
        return f"{url}: {e}"
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_bytes(data)
    return "neu"


class Downloads:
    """Ergebnis von download_all: Anzahl neu / schon vorhanden und die Fehlermeldungen."""

    def __init__(self):
        self.new, self.present, self.errors = 0, 0, []

    def all_failed(self):
        return bool(self.errors) and not self.new and not self.present


def download_all(jobs, workers, label="", tries=1, every=100, print_errors=False):
    """Lädt [(url, Zieldatei), …] parallel. Schreibt alle `every` Dateien "<label> i/n …"
    (start.py liest das als Fortschritt, every=0: still)."""
    jobs = list(jobs)
    result = Downloads()
    prefix = f"{label} " if label else ""
    with ThreadPoolExecutor(workers) as pool:
        for i, status in enumerate(pool.map(lambda job: download_file(*job, tries=tries), jobs), 1):
            if status == "neu":
                result.new += 1
            elif status == "da":
                result.present += 1
            else:
                result.errors.append(status)
                if print_errors:
                    print("Fehler", status, flush=True)
            if every and (i % every == 0 or i == len(jobs)):
                print(f"{prefix}{i}/{len(jobs)} …", flush=True)
    return result
