# BinderTracker

I bully claude into making me a nice lil tracker for my card binder. Lazy collector mode: on

A web app for tracking a Pokémon TCG collection in binders, sorted by National Pokédex number.

**Live:** https://pancodeforfun.github.io/BinderTracker/

## Features

- **Four sections** in the top bar: Binder, Wishlist, Collection and Options (language, backup, storage), each with an icon.
- **Full National Dex** (#1–#1025) laid out as 4×4 binder pages. Slot 1 is top left, slot 16 bottom right, page 2 starts with #17.
- **Two binders**: Binder 1 holds #1–#640 (40 pages), Binder 2 starts at #641 and grows with new generations.
- **Search** by German or English name or by Dex number. Jumps straight to the right binder, page and slot.
- **Card picker** with about 17,400 Pokémon cards from every English set up to September 2026. Cards are grouped into five rarity tiers and sorted by release date, each labeled with its rarity symbol (● ◆ ★ ★★ ★★★ ✦ P).
- **Reverse Holo** option on every normal and holo card, and a ★ on every card to put it on the wishlist straight from the card picker.
- **"…" menu** on every filled slot for extra options per card:
  - **Card language** of your own copy (DE by default, EN, JP). Non-German cards get a small "EN" or "JP" tag next to the name, the slot shows the image in that language where one exists, and changing the card keeps the language.
  - **Upgrade wanted**: every card below the "ex, V, GX & Co." tier counts as an upgrade automatically; rarer cards get a "Will ich ersetzen" toggle. Upgrades show an orange ↑ next to the name and can be highlighted with the "nur Upgrades" filter. Picking a new card for the slot clears the manual mark. The threshold is `UPGRADE_BELOW` in `js/config.js`.
- **Filters** next to "Anzeigen": generation, primary and secondary type, rarity tier, series, set of your card, card design chosen and note. Pokémon that don't match are dimmed in place (page and overview), active filters show as removable chips with a match count, and the choice is remembered in the browser. New filters are one entry in `FILTERS` in `js/filters.js`.
- **Overview** of all pages in a binder as mini grids, colored by rarity tier.
- **Collection** with three tabs: **Statistik** shows progress per binder and per rarity tier; **Wert** shows a rough value of your cards (Cardmarket trend price in euros via the TCGdex API, total and per binder, plus the 10 most valuable cards; prices are only requested when you press "Binderwert ermitteln" or open a card, are kept in the browser for a day and need an internet connection); **Upgrades** lists the manually marked cards plus every Pokémon with cards on the wishlist (automatic upgrades are left out), by Dex number or most common first, and a click jumps to the slot.
- **Wishlist** with three tabs: the **card list** shows all ~17,400 cards booster by booster (newest first, rarest first within a set, with a separator and set logo per booster, a "Nächstes Booster" button and a dropdown to jump to any booster; other sort orders available) and can be searched by Pokémon, card name, set (German or English) or number, with ★ to wish for a card; the **wishlist** shows wished cards as cards, longest-wished first, each with a "Nicht mehr wünschen" button, and cards you put into the binder leave it automatically; the **shopping helper** suggests booster sets (with set logo) from your wished cards, with promos and similar listed separately as singles. Click any card image there to see it full size (German or English high-resolution scan when online); ×, Escape or Back closes it.
- **Undo / redo** with Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) and the ↶ ↷ buttons in the top bar: covers slots, wishlist stars and a whole backup import (100 steps, current session only).
- **Backup** of the collection and wishlist as a JSON file, which can be restored on any device.
- **CSV export** for Excel (Options → Backup): one row per Pokémon including missing ones, with binder position, rarity, card, card language, upgrade, cached value and note. "Load backup" also reads such a CSV back (also after editing it in Excel; owned = "ja"/"yes", set and card number pick the card design). The CSV has no wishlist, so the JSON backup stays the complete copy.
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

Run `python start.py` (on Windows: double-click `start.bat`). It checks that the card images and the German card data are on disk, downloads anything missing, stops with an error if the download fails, and then serves the app at http://127.0.0.1:8000. `python start.py 8001` uses another port. `start-debug.bat` (`python start.py --debug-delay 120`) always shows the loading screen and holds it at 99 % for 120 seconds, to look at the animation. Opening `index.html` directly still works too. The collection is saved in the browser's local storage, so use **Backup speichern** regularly.

The interface and card names are in German by default. A language menu in the header switches to English (Japanese is planned); the choice is saved in the browser. In German mode the card picker shows German card and set names and the German card image where available, falling back to English.

## Roadmap

Planned next, roughly in this order:

1. Regional forms and Megas in the Dex
2. Duplicates and a trade list
3. A second binder for Trainers and Items
4. Matching a photo of a binder page to its slots
5. Japanese as a third interface language

## Project structure

Plain HTML, CSS and JavaScript without a build step. The scripts are loaded in order by `index.html` and share their functions, so the app also works when `index.html` is opened directly. Data and logic (`js/*.js`) are kept apart from the interface (`js/ui/*.js`); every change to the collection or wishlist goes through `saveEntry` / `setWish` in `js/store.js`, which also records it for undo.

| Path | Purpose |
| --- | --- |
| `js/util.js` | Small shared helpers: DOM, lists, browser and online storage, file download |
| `js/config.js` | Settings: binder size, rarity tiers, colors, symbols, storage keys |
| `js/i18n.js` | Language menu and UI texts (German, English) |
| `js/data.js` | Pokédex, sets, card lookup, binder positions, search |
| `js/store.js` | Collection and wishlist: saving in the browser, optional online sync |
| `js/history.js` | Undo / redo history for collection and wishlist |
| `js/filters.js` | Binder filters: what can be filtered and which Pokémon match |
| `js/backup.js` | JSON backup, CSV export and import |
| `js/prices.js` | Card prices from TCGdex |
| `js/ui/common.js` | Shared UI parts: view state, toasts, card images, full-size view |
| `js/ui/binder.js`, `filters.js`, `picker.js`, `collection.js`, `wishlist.js`, `search.js`, `options.js` | One file per area of the interface |
| `js/main.js` | Switches between areas, address (#…), keyboard, start-up |
| `data/` | Generated data files, do not edit by hand |
| `tools/common.py` | Shared helpers for the Python scripts (downloads, paths) |
| `tools/build_data.py` | Regenerates `data/` |
| `tools/download_images.py` | Downloads card images to `images/` |
| `tools/download_german.py` | Downloads German set data, card images and set logos from TCGdex to `sources/` |
| `start.py`, `start.bat`, `start-debug.bat`, `laden.html` | Checks/downloads data (with a loading screen in the browser), then serves the app on 127.0.0.1 |

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
- Card prices (Cardmarket): [TCGdex API](https://tcgdex.dev)
- Card data: [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data), card images from images.pokemontcg.io

## License

Code under the MIT License, see `LICENSE`.

Pokémon and all related names and images are trademarks of Nintendo, Game Freak and The Pokémon Company. This is an unofficial fan project and is not affiliated with them.
