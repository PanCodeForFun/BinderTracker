"""Startet den Binder Tracker lokal unter http://127.0.0.1:8000.

Aufruf:  python start.py   (unter Windows auch Doppelklick auf start.bat)
Fehlen Daten, zeigt der Browser eine Ladeseite (loading.html), während sie geladen werden.
Klappt der Download nicht, zeigt die Seite den Fehler und das Skript endet mit Exit-Code 1.
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

# (Bezeichnung, Datei, die nach erfolgreichem Download existiert, Download-Skript)
DATA = [
    ("Kartenbilder", "images/available.js", "tools/download_images.py"),
    ("Deutsche Kartendaten", "sources/tcgdex-de/fertig.txt", "tools/download_german.py"),
]
IMAGE_DIRS = ["sources/images-de", "images"]  # Quelle für die Karten auf der Ladeseite

# Wird von /status an die Ladeseite geliefert.
status = {"step": 0, "steps": 0, "label": "", "phase": "", "done": 0, "total": 0, "ready": False, "error": "", "cards": []}


def sample_cards(count=14):
    """Einige vorhandene Kartenbilder (URL-Pfade) für den Hintergrund."""
    for folder in IMAGE_DIRS:
        base = ROOT / folder
        if not base.is_dir():
            continue
        sets = [d for d in os.scandir(base) if d.is_dir()]
        random.shuffle(sets)
        found = []
        for d in sets[:count]:
            files = [f.name for f in os.scandir(d.path) if f.name.endswith((".png", ".webp"))]
            if files:
                found.append(f"{folder}/{d.name}/{random.choice(files)}")
        if found:
            return found
    return []


def run_download(script):
    """Startet ein Download-Skript und übernimmt Zeilen wie 'Bilder 500/14860' als Fortschritt."""
    proc = subprocess.Popen([sys.executable, "-u", str(ROOT / script)], stdout=subprocess.PIPE,
                            stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    last = ""
    for line in proc.stdout:
        line = line.strip()
        print(line)
        if m := re.match(r"(?:(\w+) )?(\d+)/(\d+)", line):
            status.update(phase=m[1] or "Bilder", done=int(m[2]), total=int(m[3]))
        elif line:
            last = line.removeprefix("FEHLER: ")
    return proc.wait(), last


def ensure_data():
    missing = [d for d in DATA if not (ROOT / d[1]).exists()]
    for label, marker, _ in DATA:
        if (ROOT / marker).exists():
            print(f"✓ {label} vorhanden")
    status["steps"] = len(missing)
    for i, (label, marker, script) in enumerate(missing, 1):
        print(f"… {label} fehlen, lade herunter ({script})")
        status.update(step=i, label=label, phase="", done=0, total=0)
        code, last = run_download(script)
        if code or not (ROOT / marker).exists():
            status["error"] = f"{label} konnten nicht geladen werden. {last}".strip()
            print(f"FEHLER: {status['error']}  Internetverbindung prüfen und neu starten.")
            return False
        status["cards"] = sample_cards()
    status["ready"] = True
    return True


class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/status":
            return super().do_GET()
        body = json.dumps(status).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):  # Konsole nur für Download-Ausgaben nutzen
        pass


def main():
    try:
        server = http.server.ThreadingHTTPServer((HOST, PORT), functools.partial(Handler, directory=str(ROOT)))
    except OSError as e:
        sys.exit(f"FEHLER: Port {PORT} ist belegt ({e}). Läuft die App schon? Sonst PORT in start.py ändern.")
    threading.Thread(target=server.serve_forever, daemon=True).start()

    url = f"http://{HOST}:{PORT}/"
    need_download = any(not (ROOT / d[1]).exists() for d in DATA)
    status["cards"] = sample_cards()
    webbrowser.open(url + ("loading.html" if need_download else ""))
    if not ensure_data():
        time.sleep(5)  # Ladeseite den Fehler noch abholen lassen
        sys.exit(1)

    print(f"Binder Tracker läuft auf {url}  (Beenden mit Strg+C)")
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        print("Beendet.")


if __name__ == "__main__":
    main()
