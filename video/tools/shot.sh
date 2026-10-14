#!/usr/bin/env bash
# Takes a full-resolution screenshot of the desktop and a half-size preview for inspection.
out=${1:-/c/Users/DELL/AppData/Local/Temp/claude/c--Users-DELL-Desktop-lastdollar/e22c9004-57a3-4ddf-806f-517f92aae81c/scratchpad/video/shot.png}
ffmpeg -y -loglevel error -f gdigrab -framerate 1 -i desktop -frames:v 1 "$out"
