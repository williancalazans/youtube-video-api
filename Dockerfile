FROM node:18-slim

RUN apt-get update && \
    apt-get install -y ffmpeg curl python3 && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Garantir que o diretório de cookies existe
RUN mkdir -p /app/cookies

EXPOSE 8080
CMD ["node", "index.js"]