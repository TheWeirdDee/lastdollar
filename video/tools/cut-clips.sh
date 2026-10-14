#!/usr/bin/env bash
# Cuts the demo clips from the raw screen takes, cropped to the browser viewport
# (no tab strip, no taskbar). Times are seconds into each take.
set -e
cd "$(dirname "$0")/.."
cut() { # name take start end
  ffmpeg -y -loglevel error -ss "$3" -to "$4" -i "footage/$2.mkv" \
    -vf "crop=1920:826:0:182,fps=30" -an -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p "public/clips/$1.mp4"
  echo "$1 $(ffprobe -v error -show_entries format=duration -of csv=p=0 public/clips/$1.mp4)"
}
cut k01-balance      take-b-payment   3    12
cut k02-problem      take-a5-landing  58   75
cut k03-hero         take-a5-landing  0    12
cut k04-recipient    take-b-payment   18   40
cut k05a-maxnative   take-b-payment   68   96
cut k05b-quoting     take-b-payment   110  124
cut k05c-quote       take-b-payment   156  176
cut k06-remaining    take-b-payment   124  142
cut k07-review       take-b2-sign     0    34
cut k08a-wallet      take-b2-sign     36   44
cut k08b-confirm     take-b2-sign     57.3 59.2
cut k09a-verified    take-b2-sign     64   74
cut k09b-receipt     take-c           28   44
cut k09c-fees        take-c           88   108
cut k10a-explorer    take-c           150  172
cut k10b-reverify    take-a3-proof    56   68
cut k11-developers   take-a4-developers 12 32
