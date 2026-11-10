"""Baut data/pokedex.js, data/sprites.js, data/cards.js und data/forms.js neu.

Aufruf (Python 3 und git, Internet nötig):  python tools/build_data.py
Quellen: PokeAPI (Namen, Bilder), PokemonTCG/pokemon-tcg-data (Karten, Seltenheiten)
und TCGdex (deutsche Karten- und Set-Namen, wird nach sources/tcgdex-db geklont).
"""
import base64
import csv
import io
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor

from common import DATA, ROOT, http_get as get

RAW = "https://raw.githubusercontent.com"
POKEAPI_CSV = f"{RAW}/PokeAPI/pokeapi/master/data/v2/csv"
SPRITE_URL = f"{RAW}/PokeAPI/sprites/master/sprites/pokemon/{{}}.png"
TCG = f"{RAW}/PokemonTCG/pokemon-tcg-data/master"
TCGDEX_GIT = "https://github.com/tcgdex/cards-database.git"
TCGDEX = ROOT / "sources" / "tcgdex-db"
# Sets, deren englischer Name bei TCGdex anders lautet: pokemon-tcg-data-ID -> TCGdex-ID
TCGDEX_SET_IDS = {"base1": "base1", "hgss2": "hgss2", "hgss3": "hgss3", "hgss4": "hgss4",
                  "fut20": "fut2020", "svp": "svp", "sve": "sve", "me55c": "30th-c"}
LANG_DE, LANG_EN = "6", "9"
# Besondere Pokémon, die die PokeAPI nicht als Merkmal führt (Dex-Nummern)
ULTRA_BEASTS = [*range(793, 800), *range(803, 807)]
PARADOX = [*range(984, 996), 1005, 1006, 1009, 1010, *range(1020, 1024)]
# Formen mit eigenem Slot im Formen-Anhang (FORM_REGIONS in js/config.js), in dieser Reihenfolge.
# Slot-Nummer = Code * 10000 + Dex-Nummer, z. B. 10026 = Alola-Raichu. Nie ändern, die Sammlung speichert sie.
FORM_CODES = {"alola": 1, "galar": 2, "hisui": 3, "paldea": 4, "mega": 5, "primal": 6}
# Sonderformen, die keinen eigenen Slot bekommen (PokeAPI-Bezeichner enthält eines dieser Wörter)
FORM_SKIP = {"totem", "cap"}

# Original-Seltenheit der Karte -> Kategorie (RARITIES[].id in js/config.js)
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


def csv_rows(name):
    return csv.DictReader(io.StringIO(get(f"{POKEAPI_CSV}/{name}.csv").decode("utf-8")))


def write_js(name, header, **variables):
    body = "".join(f"window.{k} = {json.dumps(v, ensure_ascii=False, separators=(',', ':'))};\n" for k, v in variables.items())
    (DATA / name).write_text(f"// {header}\n{body}", encoding="utf-8")


def build_pokedex():
    names = {}
    for r in csv_rows("pokemon_species_names"):
        if r["local_language_id"] in (LANG_DE, LANG_EN):
            names.setdefault(int(r["pokemon_species_id"]), {})[r["local_language_id"]] = r["name"]
    species = list(csv_rows("pokemon_species"))
    gen = {int(r["id"]): int(r["generation_id"]) for r in species}
    # Gruppe für den Filter „Besonderheit“ (KIND in js/config.js), leer bei normalen Pokémon
    kind = {n: "ultra" for n in ULTRA_BEASTS} | {n: "paradox" for n in PARADOX}
    for r in species:
        for flag in ("is_mythical", "is_legendary", "is_baby"):
            if r[flag] == "1":
                kind.setdefault(int(r["id"]), flag[3:])
    # Typen der Standardform (pokemon_id = Dex-Nummer), englischer Bezeichner wie in TYPES (js/config.js)
    type_ids = {r["id"]: r["identifier"] for r in csv_rows("types")}
    types = {}
    for r in sorted(csv_rows("pokemon_types"), key=lambda r: int(r["slot"])):
        types.setdefault(int(r["pokemon_id"]), []).append(type_ids[r["type_id"]])
    dex = [[n, names[n].get(LANG_DE, names[n][LANG_EN]), names[n][LANG_EN], gen[n], types.get(n, []), *([kind[n]] if n in kind else [])]
           for n in sorted(gen)]
    write_js("pokedex.js", "Nationaldex: [Nummer, Deutsch, Englisch, Generation, [Primärtyp, Sekundärtyp], Besonderheit falls vorhanden]",
             POKEDEX=dex)
    return [d[0] for d in dex]


def build_sprites(numbers):
    with ThreadPoolExecutor(16) as pool:
        pngs = pool.map(lambda n: get(SPRITE_URL.format(n)), numbers)
    sprites = {n: "data:image/png;base64," + base64.b64encode(p).decode() for n, p in zip(numbers, pngs)}
    write_js("sprites.js", "Pokémon-Bilder (PokeAPI), eingebettet für Offline-Nutzung", SPRITES=sprites)


def build_forms():
    """Regionalformen, Megas und Proto-Formen aus der PokeAPI: eine Form pro Pokémon und Region
    (Mega-Glurak X und Y teilen sich einen Slot). Typen und Bild nimmt die erste Variante."""
    type_ids = {r["id"]: r["identifier"] for r in csv_rows("types")}
    types = {}
    for r in sorted(csv_rows("pokemon_types"), key=lambda r: int(r["slot"])):
        types.setdefault(r["pokemon_id"], []).append(type_ids[r["type_id"]])
    forms = {}
    for r in sorted(csv_rows("pokemon"), key=lambda r: int(r["id"])):
        words = set(r["identifier"].split("-"))
        region = next((x for x in FORM_CODES if x in words), None)
        if region and not words & FORM_SKIP:
            base = int(r["species_id"])
            forms.setdefault(FORM_CODES[region] * 10000 + base, [base, region, r["id"]])
    forms = dict(sorted(forms.items()))
    def sprite(pokemon_id):  # neue Formen haben teils noch kein Bild, dann zeigt die App das der Grundform
        try:
            return "data:image/png;base64," + base64.b64encode(get(SPRITE_URL.format(pokemon_id))).decode()
        except Exception:
            return None
    with ThreadPoolExecutor(16) as pool:
        sprites = dict(zip(forms, pool.map(lambda f: sprite(f[2]), forms.values())))
    write_js("forms.js", "Formen mit eigenem Slot: [Slot-Nummer, Dex-Nummer, Region, [Primärtyp, Sekundärtyp]]; FORM_SPRITES: Bilder (PokeAPI)",
             FORMS=[[i, base, region, types.get(pid, [])] for i, (base, region, pid) in forms.items()],
             FORM_SPRITES={i: png for i, png in sprites.items() if png})
    return len(forms)


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
    rarity_names, artists, by_dex = [], [], {}
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
            artist = c.get("artist") or ""
            if artist not in artists:
                artists.append(artist)
            entry = [set_idx, c["number"], CATEGORY_OF[rarity], c["name"], rarity_names.index(rarity),
                     "" if img == f"{s['id']}/{c['number']}.png" else img, de_name, local_id, artists.index(artist)]
            for n in c.get("nationalPokedexNumbers") or []:
                if 1 <= n <= max_n:
                    by_dex.setdefault(n, []).append(entry)

    write_js(
        "cards.js",
        "Kartendaten (PokemonTCG/pokemon-tcg-data, deutsche Namen von TCGdex). "
        "TCG_SETS: [id, Name, Serie, Erscheinung, Kartenanzahl, deutscher Name, TCGdex-ID]; "
        "TCG_CARDS[Dex]: [Set-Index, Nummer, Kategorie, Name, Seltenheit-Index, Bildpfad falls abweichend, deutscher Name, TCGdex-Nummer, Illustrator-Index]",
        TCG_SETS=[[s["id"], s["name"], s["series"], s["releaseDate"][:7].replace("/", "-"), s.get("printedTotal", s["total"]),
                   de_set, tcgdex_id] for s, (tcgdex_id, de_set, _) in zip(sets, german)],
        TCG_RARITY_NAMES=rarity_names,
        TCG_CARDS=dict(sorted(by_dex.items())),
        TCG_ARTISTS=artists,
    )
    missing = {c.get("rarity") for cards in set_cards for c in cards if c.get("supertype") == "Pokémon"} - set(CATEGORY_OF) - {None}
    if missing:
        print("Unbekannte Seltenheiten (in CATEGORY eintragen):", missing)


if __name__ == "__main__":
    numbers = build_pokedex()
    build_sprites(numbers)
    build_cards(max(numbers))
    forms = build_forms()
    print(f"{len(numbers)} Pokémon und {forms} Formen gebaut.")
