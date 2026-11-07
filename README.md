# BinderTracker

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
- Works offline when opened locally. Card images load from the internet when available.

### Rarity tiers

| Tier | Includes |
| --- | --- |
| Normal | Common, Uncommon, Rare |
| Holo, Reverse & Promo | Holo, Reverse Holo, Promo |
| ex, V, GX & Co. | EX, GX, V, ex, VMAX, VSTAR |
| Full Art, Illustration & Shiny | Full Art / Ultra Rare, Illustration Rare, Shiny |
| Special Illustration & Secret | Special Illustration Rare, Hyper, Gold, Rainbow |

## Usage

Open `index.html` in a browser. No installation or build step is needed. The collection is saved in the browser's local storage, so use **Backup speichern** regularly.

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

### Updating card data

When new sets are released, run:

```sh
python tools/build_data.py
```

This downloads the latest Pokémon names, sprites and card data and rewrites the files in `data/`. The script prints any new rarity names that still need a tier in `CATEGORY`.

## Data sources

- Pokémon names and sprites: [PokeAPI](https://github.com/PokeAPI)
- Card data: [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data), card images from images.pokemontcg.io

## License

Code under the MIT License, see `LICENSE`.

Pokémon and all related names and images are trademarks of Nintendo, Game Freak and The Pokémon Company. This is an unofficial fan project and is not affiliated with them.
