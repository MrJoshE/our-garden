# Garden Journal

An installable web app for keeping a record of the plants in a garden. Everything stays on the device in IndexedDB. The brief is in `developer-agent-prompt.md`.

## Run

```sh
npm install
npm run dev      # served on your network too, so you can open it on a phone
```

## Test

```sh
npm test         # once
npm run test:watch
```

Tests run in Node against an in-memory IndexedDB (`fake-indexeddb`), in UK time.

## Build

```sh
npm run build    # static files in dist/
npm run preview
```

## Deploy

`dist/` is plain static files that any static host can serve. Serve them over HTTPS: the service worker won't run without it.

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
sudo systemctl reload caddy
```

The first build starts straight away. Each build goes into `/srv/garden/releases/<commit>`, and `/srv/garden/current` only switches to it once the build has finished. A failed build leaves the site as it was and is tried again at the next check.

- `journalctl -u garden-update` shows each deploy and any failures.
- `sudo systemctl start garden-update` checks now instead of waiting.
- To roll back, revert the commit on `main`. The Pi only ever serves `main`.
- If the service, timer or Caddyfile in `deploy/` changes, copy it again, then run `sudo systemctl daemon-reload` and `sudo systemctl reload caddy`.
- The Caddyfile replaces Debian's default one. If Caddy already serves other sites on the Pi, add this block to your own Caddyfile instead.
