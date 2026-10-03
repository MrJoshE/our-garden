# Garden Journal

An installable web app for keeping a record of the plants in a garden. Everything stays on the device in IndexedDB, and it works offline once installed. The brief is in `developer-agent-prompt.md`. The choices it didn't cover, and what was added to `theme.css`, are in `NOTES.md`.

## Run

```sh
npm install
npm run dev      # served on your network too, so you can open it on a phone
```

In development, the garden menu has **Load sample garden**, which adds a garden of 25 plants with entries, problems and drawn photos. It isn't in the production build.

## Test

```sh
npm test         # once
npm run test:watch
```

Tests run in Node against an in-memory IndexedDB (`fake-indexeddb`), in UK time. They cover the database module (including a backup export and import round trip) and `dates.js`.

```sh
npm run check    # type-checks the JSDoc in src/lib
```

## Build

```sh
npm run build    # static files in dist/
npm run preview
```

## Using it on a phone

- **iPhone:** open the site in Safari, tap Share, then Add to Home Screen, and use it from the Home Screen from then on. Safari and the Home Screen app keep separate storage, so a journal started in Safari doesn't appear in the installed app. The app says this on first run in Safari. To move one across, use Export in Backup and settings, then Restore a backup on the installed app's welcome screen.
- **Android:** Chrome offers to install the app.
- **Backups:** Backup and settings (in the garden menu) exports everything, photos included, as one zip. On iPhone it goes to the share sheet, so it can be saved to Files. Elsewhere it downloads. Import merges a backup into the journal, keeping the more recent copy of anything both have. A new phone can restore one from the welcome screen.
- **Updates:** a new version waits until **Update now** is tapped on its banner. The app never reloads by itself.

## Deploy

`dist/` is plain static files that any static host can serve. Serve them over HTTPS: the service worker won't run without it. Over plain HTTP, such as the Pi's port 16000 or `npm run dev` on your network, the app still works but can't be used offline or installed.

### On a Raspberry Pi

The Pi checks GitHub every 5 minutes, builds any new commit on `main`, and Caddy serves it over HTTP on port 16000. For HTTPS, point a Cloudflare Tunnel at `http://localhost:16000`.

You need a Pi 3, 4 or 5 running 64-bit Raspberry Pi OS Trixie, whose `nodejs` package (20.19) is new enough to build the app. Bookworm's is too old. npm warns that Vitest wants Node 22; that doesn't matter, because the Pi doesn't run the tests.

```sh
sudo apt update && sudo apt install -y git nodejs npm caddy
sudo useradd --system --home-dir /srv/garden --shell /usr/sbin/nologin garden
sudo install -d -o garden -g garden -m 755 /srv/garden
sudo -u garden git clone https://github.com/MrJoshE/our-garden.git /srv/garden/repo
cd /srv/garden/repo/deploy
sudo cp garden-update.service garden-update.timer /etc/systemd/system/
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable --now garden-update.timer
sudo systemctl restart caddy
```

The first build starts straight away. Each build goes into `/srv/garden/releases/<commit>`, and `/srv/garden/current` only switches to it once the build has finished. A failed build leaves the site as it was and is tried again at the next check.

- `journalctl -u garden-update` shows each deploy and any failures.
- `sudo systemctl start garden-update` checks now instead of waiting.
- To roll back, revert the commit on `main`. The Pi only ever serves `main`.
- If the service, timer or Caddyfile in `deploy/` changes, copy it again, then run `sudo systemctl daemon-reload` and `sudo systemctl restart caddy`.
- The Caddyfile replaces Debian's default one. If Caddy already serves other sites on the Pi, add this block to your own Caddyfile instead.
