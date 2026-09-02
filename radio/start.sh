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
# Headless: sclang links Qt and will abort without a platform plugin.
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"
export QTWEBENGINE_DISABLE_SANDBOX=1
export QTWEBENGINE_CHROMIUM_FLAGS="--no-sandbox --disable-gpu"
export JACK_NO_AUDIO_RESERVATION=1
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-root}"
mkdir -p "$XDG_RUNTIME_DIR" /root/.local/share/SuperCollider/synthdefs
chmod 700 "$XDG_RUNTIME_DIR"

mkdir -p /var/log/icecast2 /usr/share/icecast2
chown -R icecast2:icecast /var/log/icecast2
sed -e "s/SOURCE_PASSWORD/${SOURCE_PASSWORD}/g" \
    -e "s/ADMIN_PASSWORD/${ADMIN_PASSWORD}/g" \
    radio/icecast.xml.template > /tmp/icecast.xml

echo "radio.start jackd"
# Docker cannot mlock; realtime dummy driver bus-errors on a 64 MB /dev/shm.
jackd --no-realtime -d dummy --rate 48000 --period 1024 --capture 0 --playback 2 &
for _ in $(seq 1 20); do
  jack_lsp >/dev/null 2>&1 && break
  sleep 0.25
done

echo "radio.start icecast"
icecast2 -c /tmp/icecast.xml &
sleep 1

# Let sclang boot scsynth. A pre-started server is /quit'd by waitForBoot
# and ffmpeg then records a dead JACK client.
echo "radio.start sclang"
sclang -D radio/patch/boot.scd &
for _ in $(seq 1 80); do
  jack_lsp 2>/dev/null | grep -q '^SuperCollider:out' && break
  sleep 0.25
done
sleep 2

echo "radio.start broadcast"
npm run broadcast &

echo "radio.start ffmpeg -> icecast :8000/bosphorus"
# ffmpeg -i is the JACK *client name it registers*, not the source to tap.
# Wire SuperCollider outputs into that client after it appears.
connect_sc_to_ffmpeg() {
  local tries=0
  while [ "$tries" -lt 20 ]; do
    if jack_lsp 2>/dev/null | grep -q '^bosphorus_radio:input'; then
      jack_connect SuperCollider:out_1 bosphorus_radio:input_1
      jack_connect SuperCollider:out_2 bosphorus_radio:input_2
      echo "radio.jack.connected SuperCollider -> bosphorus_radio"
      return 0
    fi
    tries=$((tries + 1))
    sleep 0.25
  done
  echo "radio.jack.connect_failed"
  return 1
}

while true; do
  connect_sc_to_ffmpeg &
  ffmpeg -hide_banner -loglevel error \
    -f jack -i bosphorus_radio \
    -ac 2 -ar 48000 -c:a libmp3lame -b:a 96k \
    -f mp3 \
    -content_type audio/mpeg \
    -ice_name "Bosphorus" \
    "icecast://source:${SOURCE_PASSWORD}@127.0.0.1:8000/bosphorus" \
    && true
  echo "radio.ffmpeg.retry in 3s"
  sleep 3
done
