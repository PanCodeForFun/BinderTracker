# BinderTracker

I bully claude into making me a nice lil tracker for my card binder. Lazy collector mode: on

A web app for tracking a Pokémon TCG collection in binders, sorted by National Pokédex number.

**Live:** https://pancodeforfun.github.io/BinderTracker/

## Features

- **Full National Dex** (#1–#1025) laid out as 4×4 binder pages. Slot 1 is top left, slot 16 bottom right, page 2 starts with #17.
- **Two binders**: Binder 1 holds #1–#640 (40 pages), Binder 2 starts at #641 and grows with new generations.
- **Search** by German or English name or by Dex number. Jumps straight to the right binder, page and slot.
- **Card picker** with about 17,400 Pokémon cards from every English set up to September 2026. Cards are grouped into five rarity tiers and sorted by release date, each labeled with its rarity symbol (● ◆ ★ ★★ ★★★ ✦ P).
- **Reverse Holo** option on every normal and holo card.
- **Overview** of all pages in a binder as mini grids, colored by rarity tier.
- **Statistics** for collection progress per binder and per rarity tier.
- **Backup** of the collection as a JSON file, which can be restored on any device.
- Works fully offline when opened locally. Names, sprites and card data ship with the app; card images can be downloaded once (see below).

### Rarity tiers

| Tier | Includes |
| --- | --- |
| Normal | Common, Uncommon, Rare |
| Holo, Reverse & Promo | Holo, Reverse Holo, Promo |
| ex, V, GX & Co. | EX, GX, V, ex, VMAX, VSTAR |
| Full Art, Illustration & Shiny | Full Art / Ultra Rare, Illustration Rare, Shiny |
| Special Illustration & Secret | Special Illustration Rare, Hyper, Gold, Rainbow |

## Usage

Run `python start.py` (on Windows: double-click `start.bat`). It checks that the card images and the German card data are on disk, downloads anything missing, stops with an error if the download fails, and then serves the app at http://127.0.0.1:8000. Opening `index.html` directly still works too. The collection is saved in the browser's local storage, so use **Backup speichern** regularly.

The interface is in German.

## Project structure

| Path | Purpose |
| --- | --- |
| `js/config.js` | Settings: binder size, rarity tiers, colors, symbols |
| `js/data.js` | Pokédex, card lookup, binder positions, search |
| `js/store.js` | Saving, optional online sync, backup |
| `js/ui.js` | User interface |
| `data/` | Generated data files, do not edit by hand |
| `tools/build_data.py` | Regenerates `data/` |
| `tools/download_images.py` | Downloads card images to `images/` |
| `tools/download_german.py` | Downloads German set data and card images from TCGdex to `sources/` |
| `start.py`, `start.bat`, `loading.html` | Checks/downloads data (with a loading screen in the browser), then serves the app on 127.0.0.1 |

### Offline card images

Card images normally load from images.pokemontcg.io. To keep a local copy that works without internet or if that service goes away, run:

```sh
python tools/download_images.py                     # all cards (~17,400 images)
python tools/download_images.py binder-backup.json  # only the cards in a backup
```

Images are saved to `images/` and the app uses them automatically, falling back to the internet for anything missing. The download can be interrupted and resumed. `images/` is excluded from git because of its size.

### Updating card data

When new sets are released, run:

```sh
python tools/build_data.py
```

This downloads the latest Pokémon names, sprites and card data and rewrites the files in `data/`. The script prints any new rarity names that still need a tier in `CATEGORY`.

## Data sources

- Pokémon names and sprites: [PokeAPI](https://github.com/PokeAPI)
- German set data and card images: [TCGdex](https://github.com/tcgdex/cards-database)
- Card data: [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data), card images from images.pokemontcg.io

## License

Code under the MIT License, see `LICENSE`.

Pokémon and all related names and images are trademarks of Nintendo, Game Freak and The Pokémon Company. This is an unofficial fan project and is not affiliated with them.
