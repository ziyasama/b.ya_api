FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    jackd2 \
    icecast2 \
    ffmpeg \
    supercollider \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN chmod +x radio/start.sh

ENV OSC_HOST=127.0.0.1
ENV OSC_PORT=57121
ENV OSC_MIDI_DRY_RUN=false
ENV QT_QPA_PLATFORM=offscreen
ENV QTWEBENGINE_DISABLE_SANDBOX=1
ENV JACK_NO_AUDIO_RESERVATION=1
EXPOSE 8000

CMD ["bash", "radio/start.sh"]
