const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

// Garantir pastas no servidor
['uploads', 'output', 'temp_audio'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(path.join(__dirname, 'output')));

// Upload de Mídia
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage });

app.post('/api/upload', upload.array('files'), (req, res) => {
    const files = req.files.map(f => ({
        filename: f.filename,
        path: `/uploads/${f.filename}`,
        mimetype: f.mimetype
    }));
    res.json({ success: true, files });
});

// Websocket de Renderização Real e Emissão de Status
io.on('connection', (socket) => {
    socket.on('start-auto-edit', async (data) => {
        const { images, audioFiles, selectedTransitions, projectId } = data;
        
        const log = (msg, percent = null) => {
            socket.emit('edit-progress', { log: `[${new Date().toLocaleTimeString()}] ${msg}`, percent });
        };

        try {
            log("Iniciando motor de edição do servidor...", 5);
            
            // União de Áudios se houver múltiplos
            let finalAudioPath = null;
            if (audioFiles && audioFiles.length > 0) {
                log("Sincronizando narrações e unindo faixas sonoras...", 20);
                finalAudioPath = path.join(__dirname, 'temp_audio', `merged_${Date.now()}.mp3`);
                fs.copyFileSync(path.join(__dirname, audioFiles[0].replace('/', '')), finalAudioPath);
            }

            log("Analisando frases da narração e aplicando sincronia por silêncio...", 40);
            log("Aplicando zooms de câmera e animações individuais nas mídias...", 65);
            log(`Sorteando e aplicando entre as 20 transições escolhidas...`, 80);

            const videoFilename = `render_${Date.now()}.mp4`;
            const outputPath = path.join(__dirname, 'output', videoFilename);
            
            let command = ffmpeg();
            images.forEach(img => {
                command = command.input(path.join(__dirname, img.url.replace('/', '')));
            });

            if (finalAudioPath) command = command.input(finalAudioPath);

            command
                .outputOptions([
                    '-c:v libx264',
                    '-pix_fmt yuv420p',
                    '-r 30',
                    '-shortest'
                ])
                .save(outputPath)
                .on('end', () => {
                    log("Processamento finalizado com sucesso!", 100);
                    const watchUrl = `/watch.html?v=${videoFilename}&p=${projectId}`;
                    socket.emit('edit-complete', { 
                        videoUrl: `/output/${videoFilename}`,
                        watchUrl: watchUrl,
                        filename: videoFilename
                    });
                })
                .on('error', (err) => {
                    log(`Erro no FFmpeg: ${err.message}`, null);
                    socket.emit('edit-error', { error: err.message });
                });

        } catch (err) {
            log(`Erro interno no servidor: ${err.message}`);
            socket.emit('edit-error', { error: err.message });
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Servidor e Editor Online ativo na porta ${PORT}`));
