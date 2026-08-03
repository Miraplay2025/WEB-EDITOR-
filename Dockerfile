FROM node:20-bullseye

# Instalar FFmpeg, Python3 e Pip
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Instalar Whisper Open-Source do GitHub (sem necessidade de API paga)
RUN pip3 install --no-cache-dir openai-whisper

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p uploads output temp_audio

EXPOSE 3000

CMD ["npm", "start"]
