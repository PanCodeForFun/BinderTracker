"""Startet den Binder Tracker lokal unter http://127.0.0.1:8000.

Aufruf:  python start.py   (unter Windows auch Doppelklick auf start.bat)
Fehlen Daten, lädt das Skript sie zuerst herunter. Klappt das nicht, bricht es mit Fehler ab.
"""
import functools
import http.server
import pathlib
import subprocess
import sys
import webbrowser

HOST, PORT = "127.0.0.1", 8000
ROOT = pathlib.Path(__file__).resolve().parent

# (Bezeichnung, Datei, die nach erfolgreichem Download existiert, Download-Skript)
DATA = [
    ("Kartenbilder", "images/available.js", "tools/download_images.py"),
    ("Deutsche Kartendaten", "sources/tcgdex-de/fertig.txt", "tools/download_german.py"),
]


def ensure_data():
    for label, marker, script in DATA:
        if (ROOT / marker).exists():
            print(f"✓ {label} vorhanden")
            continue
        print(f"… {label} fehlen, lade herunter ({script})")
        if subprocess.run([sys.executable, str(ROOT / script)]).returncode or not (ROOT / marker).exists():
            sys.exit(f"FEHLER: {label} konnten nicht geladen werden. Internetverbindung prüfen und neu starten.")


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    try:
        server = http.server.ThreadingHTTPServer((HOST, PORT), handler)
    except OSError as e:
        sys.exit(f"FEHLER: Port {PORT} ist belegt ({e}). Läuft die App schon? Sonst PORT in start.py ändern.")
    url = f"http://{HOST}:{PORT}/"
    print(f"Binder Tracker läuft auf {url}  (Beenden mit Strg+C)")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Beendet.")


if __name__ == "__main__":
    ensure_data()
    serve()
