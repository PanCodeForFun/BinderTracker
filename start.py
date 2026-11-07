"""Startet den Binder Tracker lokal unter http://127.0.0.1:8000.

Aufruf:  python start.py [Port]   (unter Windows auch Doppelklick auf start.bat)

Der Server startet sofort und öffnet im Browser den Ladebildschirm (laden.html).
Fehlen Daten, laufen die Download-Skripte im Hintergrund; der Fortschritt steht
unter /api/status. Klappt ein Download nicht, zeigt die Seite den Fehler und das
Skript beendet sich mit Exit-Code 1.
"""
import functools
import http.server
import json
import os
import pathlib
import random
import re
import subprocess
import sys
import threading
import time
import webbrowser

HOST, PORT = "127.0.0.1", 8000
ROOT = pathlib.Path(__file__).resolve().parent

# Bezeichnung, Datei, die nach erfolgreichem Download existiert, Skript,
# Fortschrittsphasen: Zeilenanfang -> (Start, Anteil) innerhalb dieses Schritts
DATA = [
    {
        "label": "Kartenbilder",
        "marker": "images/available.js",
        "script": "tools/download_images.py",
        "phases": {"": (0.0, 1.0)},
        "unit": "Bilder",
    },
    {
        "label": "Deutsche Kartendaten",
        "marker": "sources/tcgdex-de/fertig.txt",
        "script": "tools/download_german.py",
        "phases": {"Sets": (0.0, 0.1), "Bilder": (0.1, 0.9)},
        "unit": "Bilder",
    },
]

# Ordner mit Kartenbildern für den Hintergrund des Ladebildschirms
CARD_DIRS = [("sources/images-de", ".webp"), ("images", ".png")]

PROGRESS = re.compile(r"^\s*(Sets|Bilder)?\s*(\d+)/(\d+)")
LOCK = threading.Lock()
STATUS = {"state": "running", "percent": 0.0, "steps": [], "error": None}


def status_snapshot():
    with LOCK:
        return json.loads(json.dumps(STATUS))


def update_percent():
    """Gesamtfortschritt = Mittel über alle Schritte, die laden mussten."""
    todo = [s for s in STATUS["steps"] if s["needed"]]
    if not todo:
        STATUS["percent"] = 100.0
    else:
        STATUS["percent"] = round(100 * sum(s["fraction"] for s in todo) / len(todo), 1)


def run_step(step, cfg):
    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUNBUFFERED="1")
    proc = subprocess.Popen(
        [sys.executable, "-u", str(ROOT / cfg["script"])],
        cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8", errors="replace",
    )
    last_error = None
    for line in proc.stdout:
        print(line, end="", flush=True)
        text = line.strip()
        if text.startswith("FEHLER"):
            last_error = text.removeprefix("FEHLER:").strip()
        m = PROGRESS.match(text)
        if not m:
            continue
        phase, done, total = m.group(1) or "", int(m.group(2)), int(m.group(3))
        start, share = cfg["phases"].get(phase, (0.0, 1.0))
        with LOCK:
            step["fraction"] = min(1.0, start + share * done / max(total, 1))
            step["done"], step["total"] = done, total
            step["detail"] = f"{'Sets' if phase == 'Sets' else cfg['unit']} {done:,} von {total:,}".replace(",", ".")
            update_percent()
    rc = proc.wait()
    if rc or not (ROOT / cfg["marker"]).exists():
        raise RuntimeError(last_error or f"{cfg['label']} konnten nicht geladen werden. Internetverbindung prüfen und neu starten.")


def ensure_data():
    with LOCK:
        for cfg in DATA:
            present = (ROOT / cfg["marker"]).exists()
            STATUS["steps"].append({
                "label": cfg["label"], "needed": not present,
                "state": "ok" if present else "wait",
                "fraction": 1.0 if present else 0.0,
                "detail": "vorhanden" if present else "wartet", "done": 0, "total": 0,
            })
        update_percent()

    for step, cfg in zip(STATUS["steps"], DATA):
        if not step["needed"]:
            print(f"✓ {cfg['label']} vorhanden")
            continue
        print(f"… {cfg['label']} fehlen, lade herunter ({cfg['script']})")
        with LOCK:
            step["state"], step["detail"] = "running", "startet …"
        try:
            run_step(step, cfg)
        except RuntimeError as e:
            with LOCK:
                step["state"], step["detail"] = "error", "fehlgeschlagen"
                STATUS["state"], STATUS["error"] = "error", str(e)
            raise
        with LOCK:
            step["state"], step["fraction"], step["detail"] = "ok", 1.0, "fertig"
            update_percent()
    with LOCK:
        STATUS["state"] = "done"


def card_images(count=24):
    """Zufällige lokale Kartenbilder (Pfade relativ zum Projekt)."""
    found = []
    for folder, ext in CARD_DIRS:
        base = ROOT / folder
        if not base.is_dir():
            continue
        sets = [d for d in base.iterdir() if d.is_dir()]
        random.shuffle(sets)
        for d in sets[:count]:
            files = [f for f in d.iterdir() if f.suffix == ext and f.stat().st_size > 2000]
            if files:
                found.append(random.choice(files).relative_to(ROOT).as_posix())
    random.shuffle(found)
    return found[:count]


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".webp": "image/webp", ".js": "text/javascript"}

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/status":
            return self.send_json(status_snapshot())
        if path == "/api/karten":
            return self.send_json(card_images())
        return super().do_GET()

    def send_json(self, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        # Status-Abfragen und Kartenbilder nicht ins Fenster schreiben
        if not self.path.startswith(("/api/", "/sources/", "/images/")):
            super().log_message(fmt, *args)


class Server(http.server.ThreadingHTTPServer):
    # Unter Windows erlaubt SO_REUSEADDR einen zweiten Server auf demselben Port,
    # ohne Fehler. Abschalten, damit ein schon laufender Start erkannt wird.
    allow_reuse_address = os.name != "nt"


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    handler = functools.partial(Handler, directory=str(ROOT))
    try:
        server = Server((HOST, port), handler)
    except OSError as e:
        sys.exit(f"FEHLER: Port {port} ist belegt ({e}). Läuft die App schon? Sonst PORT in start.py ändern.")
    threading.Thread(target=server.serve_forever, daemon=True).start()

    url = f"http://{HOST}:{port}/"
    print(f"Binder Tracker läuft auf {url}  (Beenden mit Strg+C)")
    webbrowser.open(url + "laden.html")

    try:
        try:
            ensure_data()
        except RuntimeError as e:
            print(f"FEHLER: {e}", file=sys.stderr)
            time.sleep(15)  # Ladebildschirm kann den Fehler noch abholen
            server.shutdown()
            sys.exit(1)
        print("Alle Daten bereit.")
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("Beendet.")
        server.shutdown()


if __name__ == "__main__":
    main()
