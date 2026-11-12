#!/bin/sh
# Builds landing/media/ (not in git) from the rendered videos, then the folder is deployed with deploy.sh.
#   story.mp4  ← app/story/story.mp4 (re-encoded, CRF 24: ~1 MB, SSIM 0.997 against the original)
#   demo-9x16.mp4 / demo-16x9.mp4 ← deliverables/khatwa-demo*.mp4 (video copied as is; the silent audio track dropped)
#   *.jpg posters
set -eu
cd "$(dirname "$0")/.."
M=landing/media
mkdir -p "$M"
ffmpeg -v error -y -i app/story/story.mp4 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -an -movflags +faststart "$M/story.mp4"
ffmpeg -v error -y -i deliverables/khatwa-demo.mp4 -map 0:v -c copy -movflags +faststart "$M/demo-9x16.mp4"
ffmpeg -v error -y -i deliverables/khatwa-demo-16x9.mp4 -map 0:v -c copy -movflags +faststart "$M/demo-16x9.mp4"
ffmpeg -v error -y -i app/story/poster.jpg -q:v 3 "$M/story.jpg"
ffmpeg -v error -y -ss "${POSTER_AT:-20}" -i deliverables/khatwa-demo.mp4 -frames:v 1 -vf scale=720:-2 -q:v 4 "$M/demo-9x16.jpg"
ffmpeg -v error -y -ss "${POSTER_AT:-20}" -i deliverables/khatwa-demo-16x9.mp4 -frames:v 1 -vf scale=1280:-2 -q:v 4 "$M/demo-16x9.jpg"
ls -la "$M"
