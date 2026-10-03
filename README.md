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
