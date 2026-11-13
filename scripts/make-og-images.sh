#!/usr/bin/env bash
# Compose the site's 1200x630 social share images from assets that already exist.
#
#   bash scripts/make-og-images.sh          # writes web/public/og/*.png
#
# Nothing original is drawn here: the background is the site's own palette (app/globals.css:
# --ink #0b1220, --accent #2563eb) and the picture is the TaskApp board screenshot that already
# ships in ~/.hermes/hermes-org/businesses/flash-apps/assets/store/hero-board-dark.png, scaled to
# the canvas width and bled off the bottom edge so it reads as a site preview.
# Text is the page name and the company name — nothing else — in the site's sans family.
#
# ffmpeg rather than ImageMagick: this host has neither ImageMagick nor pip, and drawtext /
# overlay / scale / gradients cover the job. Liberation Sans Bold is the closest installed face
# to the site's ui-sans-serif stack. Sizes were measured against the rendered output so the
# longest title ("The Author's Candle", 904px at 96) stays inside the 1056px text column.
#
# The output is served at /og/<slug>.png and named in each page's openGraph.images; the build
# gate (web/scripts/check-store.mjs --built) fails if any public page lacks one.
set -euo pipefail
cd "$(dirname "$0")/.."

STORE="${FLASH_APPS_ASSETS:-$HOME/.hermes/hermes-org/businesses/flash-apps/assets/store}"
SHOT="$STORE/hero-board-dark.png"
FONT=/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf
OUT=web/public/og

[ -f "$SHOT" ] || { echo "make-og-images: missing screenshot $SHOT" >&2; exit 1; }
[ -f "$FONT" ] || { echo "make-og-images: missing font $FONT" >&2; exit 1; }
mkdir -p "$OUT"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# make <slug> <page name>
make() {
  local slug=$1 name=$2
  # The page name goes through textfile= so an apostrophe cannot break the filter graph.
  printf '%s' "$name" > "$TMP/$slug.txt"

  local filter="[0:v]drawtext=fontfile=$FONT:text='Flash Tech':fontsize=44:fontcolor=0xffffff:x=72:y=64"
  filter="$filter,drawbox=x=72:y=126:w=64:h=5:color=0x2563eb:t=fill"
  filter="$filter,drawtext=fontfile=$FONT:textfile=$TMP/$slug.txt:fontsize=96:fontcolor=0xffffff:x=72:y=164"
  filter="$filter,drawbox=x=0:y=303:w=1200:h=1:color=0x2c3b57:t=fill[bg]"
  filter="$filter;[1:v]scale=1200:-1,eq=brightness=-0.02[shot]"
  filter="$filter;[bg][shot]overlay=0:304:format=auto[out]"

  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "gradients=s=1200x630:c0=0x16203a:c1=0x0a1120:x0=0:y0=0:x1=1200:y1=630:d=1" \
    -i "$SHOT" \
    -filter_complex "$filter" -map "[out]" -frames:v 1 -pix_fmt rgb24 \
    "$OUT/$slug.png"
  echo "make-og-images: $OUT/$slug.png"
}

make home             "Home"
make contact          "Contact"
make apps             "Apps"
make startups         "Startups"
make startups-authors "The Author's Candle"
