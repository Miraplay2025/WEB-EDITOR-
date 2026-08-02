FROM node:20-bullseye

# Instalar FFmpeg e utilitários
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p uploads output temp_audio

EXPOSE 3000

CMD ["npm", "start"]
