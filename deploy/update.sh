#!/bin/sh
# Run by garden-update.timer. Each commit is built into its own directory and
# `current` is switched to it with one rename, so a failed or half-finished
# build never touches the live site.
set -eu
cd /srv/garden/repo

git fetch --quiet origin main
sha=$(git rev-parse origin/main)
[ "$(readlink ../current)" = "releases/$sha" ] && exit 0

git reset --quiet --hard "$sha"
npm ci --no-audit --no-fund
npm run build -- --outDir "../releases/$sha" --emptyOutDir

cd ..
ln -sfn "releases/$sha" current.new
mv -T current.new current
find releases -mindepth 1 -maxdepth 1 ! -name "$sha" -exec rm -rf {} +
echo "Deployed $sha"
