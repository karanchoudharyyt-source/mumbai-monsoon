#!/bin/sh
# Joins the source parts into one self-contained HTML file (index.html, three.js from a CDN),
# plus render.html that loads three.js from node_modules for offline rendering and tests.
set -e
cd "$(dirname "$0")"
cat src/head.html src/1-core.js src/2-textures.js src/3-world.js src/4-buildings.js \
    src/5-vehicles.js src/6-fx.js src/7-run.js src/tail.html > index.html
sed -e 's#https://cdn.jsdelivr.net/npm/three@0.170.0/#./node_modules/three/#g' index.html > render.html
wc -c index.html
