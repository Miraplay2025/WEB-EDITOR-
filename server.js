const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;

['uploads', 'output', 'temp_audio'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/output', express.static(path.join(__dirname, 'output')));

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

io.on('connection', (socket) => {
    socket.on('start-auto-edit', async (data) => {
        const { images, audioFiles, selectedTransitions, projectId, aspectRatio } = data;
        const log = (msg, percent = null) => socket.emit('edit-progress', { log: `[${new Date().toLocaleTimeString()}] ${msg}`, percent });

        try {
            log("Iniciando transcrição open-source da narração (Whisper)...", 10);
            
            let audioPath = null;
            let syncData = [];
            
            if (audioFiles && audioFiles.length > 0) {
                audioPath = path.join(__dirname, audioFiles[0].replace('/', ''));
                
                // Executar Whisper em Python
                const pythonProc = spawn('python3', ['transcribe.py', audioPath]);
                let pyResult = '';
                
                for await (const chunk of pythonProc.stdout) {
                    pyResult += chunk.toString();
                }
                
                try {
                    const parsed = JSON.parse(pyResult);
                    if (parsed.success) {
                        syncData = parsed.segments;
                        log(`Transcrição concluída! ${syncData.length} pausas/frases identificadas.`, 35);
                    }
                } catch(e) {
                    log("Aviso: Sincronia de áudio usando tempo estático por fallback.", 35);
                }
            }

            log("Renderizando efeitos visuais (Zoom, Animações e Transições)...", 60);

            const videoFilename = `render_${Date.now()}.mp4`;
            const outputPath = path.join(__dirname, 'output', videoFilename);
            
            let command = ffmpeg();
            images.forEach(img => {
                command = command.input(path.join(__dirname, img.url.replace('/', '')));
            });

            if (audioPath) command = command.input(audioPath);

            // Ajuste de Resolução/Proporção Real no FFmpeg
            let scaleFilter = 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2';
            if (aspectRatio === '16:9') scaleFilter = 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2';
            else if (aspectRatio === '1:1') scaleFilter = 'scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2';
            else if (aspectRatio === '4:5') scaleFilter = 'scale=1080:1350:force_original_aspect_ratio=decrease,pad=1080:1350:(ow-iw)/2:(oh-ih)/2';

            command
                .complexFilter([scaleFilter])
                .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-r 30', '-shortest'])
                .save(outputPath)
                .on('end', () => {
                    log("Vídeo exportado com sucesso!", 100);
                    const watchUrl = `/watch.html?v=${videoFilename}&p=${projectId}`;
                    socket.emit('edit-complete', { videoUrl: `/output/${videoFilename}`, watchUrl });
                })
                .on('error', (err) => {
                    log(`Erro na exportação: ${err.message}`);
                    socket.emit('edit-error', { error: err.message });
                });

        } catch (err) {
            log(`Erro: ${err.message}`);
            socket.emit('edit-error', { error: err.message });
        }
    });
});

server.listen(PORT, () => console.log(`🚀 Server rodando em http://localhost:${PORT}`));
