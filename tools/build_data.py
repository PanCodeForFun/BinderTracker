"""Baut data/pokedex.js, data/sprites.js und data/cards.js neu.

Aufruf (Python 3, Internet nötig):  python tools/build_data.py
Quellen: PokeAPI (Namen, Bilder) und PokemonTCG/pokemon-tcg-data (Karten).
"""
import base64
import csv
import io
import json
import pathlib
import urllib.request
from concurrent.futures import ThreadPoolExecutor

RAW = "https://raw.githubusercontent.com"
POKEAPI_CSV = f"{RAW}/PokeAPI/pokeapi/master/data/v2/csv"
SPRITE_URL = f"{RAW}/PokeAPI/sprites/master/sprites/pokemon/{{}}.png"
TCG = f"{RAW}/PokemonTCG/pokemon-tcg-data/master"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data"
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


def build_cards(max_n):
    sets = sorted(json.loads(get(f"{TCG}/sets/en.json")), key=lambda s: (s["releaseDate"], s["id"]))
    with ThreadPoolExecutor(16) as pool:
        set_cards = pool.map(lambda s: json.loads(get(f"{TCG}/cards/en/{s['id']}.json")), sets)

    rarity_names, by_dex = [], {}
    for set_idx, (s, cards) in enumerate(zip(sets, set_cards)):
        for c in cards:
            rarity = c.get("rarity") or "None"
            if c.get("supertype") != "Pokémon" or rarity not in CATEGORY_OF:
                continue
            if rarity not in rarity_names:
                rarity_names.append(rarity)
            entry = [set_idx, c["number"], CATEGORY_OF[rarity], c["name"], rarity_names.index(rarity)]
            img = c["images"]["small"].replace("https://images.pokemontcg.io/", "")
            if img != f"{s['id']}/{c['number']}.png":
                entry.append(img)
            for n in c.get("nationalPokedexNumbers") or []:
                if 1 <= n <= max_n:
                    by_dex.setdefault(n, []).append(entry)

    write_js(
        "cards.js",
        "Kartendaten (PokemonTCG/pokemon-tcg-data). TCG_SETS: [id, Name, Serie, Erscheinung, Kartenanzahl]; "
        "TCG_CARDS[Dex]: [Set-Index, Nummer, Kategorie, Name, Seltenheit-Index, Bildpfad falls abweichend]",
        TCG_SETS=[[s["id"], s["name"], s["series"], s["releaseDate"][:7].replace("/", "-"), s.get("printedTotal", s["total"])] for s in sets],
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
