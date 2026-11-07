"""Baut data/pokedex.js, data/sprites.js und data/cards.js neu.

Aufruf (Python 3 und git, Internet nötig):  python tools/build_data.py
Quellen: PokeAPI (Namen, Bilder), PokemonTCG/pokemon-tcg-data (Karten, Seltenheiten)
und TCGdex (deutsche Karten- und Set-Namen, wird nach sources/tcgdex-db geklont).
"""
import base64
import csv
import io
import json
import pathlib
import re
import subprocess
import urllib.request
from concurrent.futures import ThreadPoolExecutor

RAW = "https://raw.githubusercontent.com"
POKEAPI_CSV = f"{RAW}/PokeAPI/pokeapi/master/data/v2/csv"
SPRITE_URL = f"{RAW}/PokeAPI/sprites/master/sprites/pokemon/{{}}.png"
TCG = f"{RAW}/PokemonTCG/pokemon-tcg-data/master"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data"
TCGDEX_GIT = "https://github.com/tcgdex/cards-database.git"
TCGDEX = ROOT / "sources" / "tcgdex-db"
# Sets, deren englischer Name bei TCGdex anders lautet: pokemon-tcg-data-ID -> TCGdex-ID
TCGDEX_SET_IDS = {"base1": "base1", "hgss2": "hgss2", "hgss3": "hgss3", "hgss4": "hgss4",
                  "fut20": "fut2020", "svp": "svp", "sve": "sve", "me55c": "30th-c"}
LANG_DE, LANG_EN = "6", "9"

# Original-Seltenheit der Karte -> Kategorie in js/config.js (RARITIES[].pool)
CATEGORY = {
    "normal": ["Common", "Uncommon", "Rare", "None"],
    "holo": ["Rare Holo", "Rare Holo Star", "Rare Prime", "LEGEND", "Classic Collection", "Rare Holo ex"],
    "promo": ["Promo"],
    "shiny": ["Rare Shiny", "Shiny Rare", "Rare Shiny GX", "Shiny Ultra Rare", "Rare Shining", "Radiant Rare", "Amazing Rare"],
    "ex": ["Double Rare", "Rare Holo EX", "Rare Holo GX", "Rare Holo V", "Rare Holo LV.X", "Rare BREAK", "Rare Prism Star", "Holo Rare V"],
    "vmax": ["Rare Holo VMAX", "Rare Holo VSTAR", "Holo Rare VMAX", "Holo Rare VSTAR"],
    "fullart": ["Rare Ultra", "Ultra Rare", "MEGA_ATTACK_RARE"],
    "ir": ["Illustration Rare", "Trainer Gallery Rare Holo"],
    "sir": ["Special Illustration Rare"],
    "hyper": ["Rare Rainbow", "Rare Secret", "Hyper Rare", "Mega Hyper Rare", "Black White Rare", "Futuristic Rare", "Pikachu Rare"],
}
CATEGORY_OF = {name: cat for cat, names in CATEGORY.items() for name in names}


def get(url):
    with urllib.request.urlopen(url) as r:
        return r.read()


def csv_rows(name):
    return csv.DictReader(io.StringIO(get(f"{POKEAPI_CSV}/{name}.csv").decode("utf-8")))


def write_js(name, header, **variables):
    body = "".join(f"window.{k} = {json.dumps(v, ensure_ascii=False, separators=(',', ':'))};\n" for k, v in variables.items())
    (OUT / name).write_text(f"// {header}\n{body}", encoding="utf-8")


def build_pokedex():
    names = {}
    for r in csv_rows("pokemon_species_names"):
        if r["local_language_id"] in (LANG_DE, LANG_EN):
            names.setdefault(int(r["pokemon_species_id"]), {})[r["local_language_id"]] = r["name"]
    gen = {int(r["id"]): int(r["generation_id"]) for r in csv_rows("pokemon_species")}
    dex = [[n, names[n].get(LANG_DE, names[n][LANG_EN]), names[n][LANG_EN], gen[n]] for n in sorted(gen)]
    write_js("pokedex.js", "Nationaldex: [Nummer, Deutsch, Englisch, Generation]", POKEDEX=dex)
    return [d[0] for d in dex]


def build_sprites(numbers):
    with ThreadPoolExecutor(16) as pool:
        pngs = pool.map(lambda n: get(SPRITE_URL.format(n)), numbers)
    sprites = {n: "data:image/png;base64," + base64.b64encode(p).decode() for n, p in zip(numbers, pngs)}
    write_js("sprites.js", "Pokémon-Bilder (PokeAPI), eingebettet für Offline-Nutzung", SPRITES=sprites)


def update_tcgdex():
    if (TCGDEX / ".git").exists():
        subprocess.run(["git", "-C", str(TCGDEX), "pull", "--ff-only", "-q"], check=True)
    else:
        TCGDEX.parent.mkdir(exist_ok=True)
        subprocess.run(["git", "clone", "--depth", "1", "-q", TCGDEX_GIT, str(TCGDEX)], check=True)


def ts_names(text):
    """Die erste Namensliste einer TCGdex-Datei: {"de": "...", "en": "..."}."""
    m = re.search(r"name:\s*\{([^}]*)\}", text)
    return dict(re.findall(r"""["']?([\w-]+)["']?:\s*["'](.*?)["'],?\s*$""", m[1], re.M)) if m else {}


def tcgdex_sets(sets):
    """Ordnet jedem Set aus pokemon-tcg-data das TCGdex-Set zu (über englischen Namen und Datum).
    Ergebnis: {Set-ID: (TCGdex-ID, deutscher Name, {Kartennummer: (Ordnername, deutscher Kartenname)})}"""
    norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
    found = {}
    for path in (TCGDEX / "data").glob("*/*.ts"):
        text = path.read_text(encoding="utf-8")
        set_id = re.search(r"""id:\s*["']([^"']+)""", text)[1]
        date = re.search(r"""releaseDate:\s*["']([^"']+)""", text)
        found[set_id] = (ts_names(text), date[1][:7] if date else "", path.with_suffix(""))
    by_name = {}
    for set_id, (names, date, _) in found.items():
        by_name.setdefault(norm(names.get("en", "")), []).append((set_id, date))

    key = lambda num: re.sub(r"^0+(?=\w)", "", num).lower()
    result = {}
    for s in sets:
        tid = TCGDEX_SET_IDS.get(s["id"])
        if not tid:
            options = by_name.get(norm(s["name"]), [])
            same_date = [o for o in options if o[1] == s["releaseDate"][:7].replace("/", "-")]
            tid = (same_date or options or [(None, "")])[0][0]
        if tid not in found:
            print("Kein TCGdex-Set für", s["id"], s["name"])
            continue
        names, _, folder = found[tid]
        cards = {key(f.stem): (f.stem, ts_names(f.read_text(encoding="utf-8")).get("de", "")) for f in folder.glob("*.ts")}
        result[s["id"]] = (tid, names.get("de", ""), cards)
    return result, key


def build_cards(max_n):
    sets = sorted(json.loads(get(f"{TCG}/sets/en.json")), key=lambda s: (s["releaseDate"], s["id"]))
    with ThreadPoolExecutor(16) as pool:
        set_cards = pool.map(lambda s: json.loads(get(f"{TCG}/cards/en/{s['id']}.json")), sets)

    update_tcgdex()
    german, key = tcgdex_sets(sets)
    german = [german.get(s["id"], ("", "", {})) for s in sets]
    rarity_names, by_dex = [], {}
    for set_idx, (s, cards) in enumerate(zip(sets, set_cards)):
        de_cards = german[set_idx][2]
        for c in cards:
            rarity = c.get("rarity") or "None"
            if c.get("supertype") != "Pokémon" or rarity not in CATEGORY_OF:
                continue
            if rarity not in rarity_names:
                rarity_names.append(rarity)
            img = c["images"]["small"].replace("https://images.pokemontcg.io/", "")
            local_id, de_name = de_cards.get(key(c["number"]), ("", ""))
            entry = [set_idx, c["number"], CATEGORY_OF[rarity], c["name"], rarity_names.index(rarity),
                     "" if img == f"{s['id']}/{c['number']}.png" else img, de_name, local_id]
            for n in c.get("nationalPokedexNumbers") or []:
                if 1 <= n <= max_n:
                    by_dex.setdefault(n, []).append(entry)

    write_js(
        "cards.js",
        "Kartendaten (PokemonTCG/pokemon-tcg-data, deutsche Namen von TCGdex). "
        "TCG_SETS: [id, Name, Serie, Erscheinung, Kartenanzahl, deutscher Name, TCGdex-ID]; "
        "TCG_CARDS[Dex]: [Set-Index, Nummer, Kategorie, Name, Seltenheit-Index, Bildpfad falls abweichend, deutscher Name, TCGdex-Nummer]",
        TCG_SETS=[[s["id"], s["name"], s["series"], s["releaseDate"][:7].replace("/", "-"), s.get("printedTotal", s["total"]),
                   de_set, tcgdex_id] for s, (tcgdex_id, de_set, _) in zip(sets, german)],
        TCG_RARITY_NAMES=rarity_names,
        TCG_CARDS=dict(sorted(by_dex.items())),
    )
    missing = {c.get("rarity") for cards in set_cards for c in cards if c.get("supertype") == "Pokémon"} - set(CATEGORY_OF) - {None}
    if missing:
        print("Unbekannte Seltenheiten (in CATEGORY eintragen):", missing)


if __name__ == "__main__":
    numbers = build_pokedex()
    build_sprites(numbers)
    build_cards(max(numbers))
    print(f"{len(numbers)} Pokémon gebaut.")
