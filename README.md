# Grid Munch

A neon maze-chase arcade game — clear every pellet in the maze while
dodging four ghosts, each with a different chase strategy. Built as an
installable, fully offline-capable Progressive Web App (PWA) with no
build step, so it deploys straight to GitHub Pages.

Note on originality: this is inspired by the classic 1980s dot-eating
arcade genre, but uses original names, art, mazes, and code — it
doesn't reuse Pac-Man's trademarked name or copyrighted assets.

## Features

- Classic grid-based maze-chase gameplay with smooth movement
- 4 ghosts with distinct AI personalities (direct chaser, ambusher,
  pincer, wanderer) that alternate between scatter and chase modes,
  plus a frightened mode when you eat a power pellet
- 3 hand-built, connectivity-validated mazes that cycle with
  increasing difficulty (faster ghosts, shorter power-pellet windows)
- Bonus fruit that appears mid-level for extra points
- Local high score table (top 10, saved to the device)
- Keyboard (arrow keys / WASD), touch swipe, and on-screen d-pad controls
- Installable ("Add to Home Screen") and **plays fully offline** once
  loaded, via a service worker that caches all game assets

## Project structure

```
index.html          Page shell, HUD, and overlay screens
style.css            Neon arcade theme, responsive layout
manifest.json         PWA manifest (name, icons, display mode)
service-worker.js     Offline asset caching
js/
  maze-data.js         Validated maze layouts (generated + checked for
                        full pellet reachability before being baked in)
  maze.js              Maze collision/rendering wrapper
  entities.js           Player + Ghost classes (movement, AI)
  input.js               Keyboard / touch / swipe input
  storage.js               High score persistence (localStorage)
  game.js                    Main loop, state machine, scoring
icons/                 App icons (192/512, regular + maskable)
```

## Run it locally

No build step and no dependencies — it's plain HTML/CSS/JS. You do
need to serve it over HTTP (not `file://`) for the service worker to
register:

```bash
cd gridmunch
python3 -m http.server 8080
# then open http://localhost:8080
```

## Deploy to GitHub Pages

1. Create a new GitHub repository and push this folder's contents to
   the root of the `main` branch (or push it into a `/docs` folder —
   either works, just pick the matching option in step 2).
2. In the repo, go to **Settings → Pages**. Under "Build and
   deployment", set **Source** to "Deploy from a branch", pick the
   `main` branch, and select either `/ (root)` or `/docs` depending on
   where you put the files.
3. Save. GitHub gives you a URL like
   `https://<username>.github.io/<repo-name>/`. The first deploy
   usually takes a minute or two.
4. Open that URL. The game should load, and your browser should offer
   to install it (or you can install manually via the browser menu).

Everything uses relative paths (`./`) specifically so it works from a
GitHub Pages *project* URL (a subpath like `/repo-name/`), not just
from a domain root.

## Testing offline mode

1. Load the deployed (or locally served) page once while online, so
   the service worker can install and cache everything.
2. In Chrome/Edge DevTools: **Application → Service Workers**, confirm
   it's "activated and running." Then check **Application → Cache
   Storage** and confirm `gridmunch-v1` lists all the game files.
3. Turn on DevTools' **Network → Offline** checkbox (or actually
   disconnect from the network) and reload the page. The game should
   load and play normally with zero network requests.
4. On mobile: install the app to the home screen, then switch the
   device to airplane mode and relaunch it from the home screen icon.

## Updating after you've deployed

Browsers cache the service worker itself too, so if you change any
game file later, bump `CACHE_VERSION` in `service-worker.js` (e.g.
`gridmunch-v1` → `gridmunch-v2`). That forces the old cache to be
discarded and the new assets to be fetched and cached on the next
visit.

## Customizing

- **Add another maze**: mazes live in `js/maze-data.js` as a grid of
  characters (`#` wall, `.` pellet, `o` power pellet, `-` ghost pen
  door, space = open path). Add a new `levelN` entry and add its key
  to `LEVEL_KEYS` in `js/game.js`. Double-check every pellet is
  reachable before shipping a hand-edited maze — an unreachable pellet
  means the level can never be cleared.
- **Difficulty curve**: tune ghost/player speed scaling and the
  frightened-mode duration in `_loadLevel()` in `js/game.js`.
- **Colors/theme**: all colors are CSS custom properties at the top of
  `style.css`, plus matching hex values in the canvas-drawing code in
  `js/maze.js` and `js/entities.js`.
