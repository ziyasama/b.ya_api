#!/usr/bin/env bash
# Radio container: JACK dummy -> SuperCollider -> ffmpeg MP3 -> Icecast.
# Node broadcaster talks to sclang over 127.0.0.1:57121.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SOURCE_PASSWORD="${ICECAST_SOURCE_PASSWORD:-change-me-source}"
ADMIN_PASSWORD="${ICECAST_ADMIN_PASSWORD:-change-me-admin}"
export OSC_HOST="${OSC_HOST:-127.0.0.1}"
export OSC_PORT="${OSC_PORT:-57121}"
export OSC_MIDI_DRY_RUN="${OSC_MIDI_DRY_RUN:-false}"

mkdir -p /var/log/icecast2 /usr/share/icecast2
sed -e "s/SOURCE_PASSWORD/${SOURCE_PASSWORD}/g" \
    -e "s/ADMIN_PASSWORD/${ADMIN_PASSWORD}/g" \
    radio/icecast.xml.template > /tmp/icecast.xml

echo "radio.start jackd"
jackd -d dummy -r 48000 -p 1024 &
sleep 1

echo "radio.start icecast"
icecast2 -c /tmp/icecast.xml &
sleep 1

echo "radio.start scsynth"
scsynth -u 57110 -a 128 -i 0 -o 2 &
sleep 1

echo "radio.start sclang"
sclang radio/patch/boot.scd &
sleep 2

echo "radio.start broadcast"
npm run broadcast &

echo "radio.start ffmpeg -> icecast :8000/bosphorus"
# Retry: SuperCollider's JACK client can take a few seconds to appear.
while true; do
  ffmpeg -hide_banner -loglevel error \
    -f jack -i SuperCollider \
    -ac 2 -c:a libmp3lame -b:a 96k \
    -content_type audio/mpeg \
    -ice_name "Bosphorus" \
    "icecast://source:${SOURCE_PASSWORD}@127.0.0.1:8000/bosphorus" \
    && true
  echo "radio.ffmpeg.retry in 3s"
  sleep 3
done
