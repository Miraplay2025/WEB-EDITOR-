const socket = io();

let savedProjects = JSON.parse(localStorage.getItem('studio_projects_v2') || '[]');
let currentProject = null;
let selectedIndex = 0;
let isPlaying = false;
let playTimer = null;
let currentAspect = '9:16';
let selectedTransitions = [];

const mediaInput = document.getElementById('media-input');
const audioInput = document.getElementById('audio-input');
const previewElement = document.getElementById('preview-element');
const previewStage = document.getElementById('preview-stage');
const timelineContainer = document.getElementById('timeline-items-container');
const btnPlayPause = document.getElementById('btn-play-pause');

// GERENCIAMENTO DE TELAS/RECURSOS
function openResourcePanel(panelId) {
    document.querySelectorAll('.panel-mode').forEach(p => p.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
}

document.querySelectorAll('.btn-back-default').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.panel-mode').forEach(p => p.classList.remove('active'));
        document.getElementById('default-timeline-panel').classList.add('active');
    };
});

// ALTERAR PROPORÇÃO
function setAspectRatio(aspect) {
    currentAspect = aspect;
    previewStage.className = '';
    if (aspect === '9:16') previewStage.className = 'aspect-9-16';
    else if (aspect === '16:9') previewStage.className = 'aspect-16-9';
    else if (aspect === '1:1') previewStage.className = 'aspect-1-1';
    else if (aspect === '4:5') previewStage.className = 'aspect-4-5';
}

// DASHBOARD
function renderDashboard() {
    const grid = document.getElementById('projects-grid');
    const empty = document.getElementById('empty-projects');
    grid.innerHTML = '';

    if (savedProjects.length === 0) {
        empty.style.display = 'block';
    } else {
        empty.style.display = 'none';
        savedProjects.forEach((proj, idx) => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.innerHTML = `
                <h4>Projeto #${proj.id}</h4>
                <p style="font-size:0.8rem; color:#aaa;">Mídias: ${proj.images.length}</p>
                ${proj.watchUrl ? `<a href="${proj.watchUrl}" class="btn-success" style="display:inline-block; margin-top:5px; text-decoration:none;">▶️ Assistir</a>` : ''}
                <button class="btn-danger" style="margin-top:5px;" onclick="deleteProject(${idx})">Excluir</button>
            `;
            grid.appendChild(card);
        });
    }
}

function deleteProject(idx) {
    savedProjects.splice(idx, 1);
    localStorage.setItem('studio_projects_v2', JSON.stringify(savedProjects));
    renderDashboard();
}

// NOVO PROJETO E ADICIONAR MAIS MÍDIA
document.getElementById('btn-new-project').onclick = () => mediaInput.click();
document.getElementById('btn-add-more-media').onclick = () => mediaInput.click();

mediaInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
        const newImages = data.files.map(f => ({ url: f.path, animation: null, zoom: null }));
        if (!currentProject) {
            currentProject = { id: Date.now(), images: newImages, audios: [], watchUrl: null };
            openEditor();
        } else {
            currentProject.images.push(...newImages);
            renderTimeline();
        }
        saveCurrentDraft();
    }
};

function saveCurrentDraft() {
    const idx = savedProjects.findIndex(p => p.id === currentProject.id);
    if (idx >= 0) savedProjects[idx] = currentProject;
    else savedProjects.push(currentProject);
    localStorage.setItem('studio_projects_v2', JSON.stringify(savedProjects));
}

function openEditor() {
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('editor-view').classList.add('active');
    selectedIndex = 0;
    renderTimeline();
    renderAnimationsOptions();
    renderZoomOptions();
    renderTransitionsOptions();
}

document.getElementById('btn-back-dash').onclick = () => {
    saveCurrentDraft();
    document.getElementById('editor-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
    renderDashboard();
};

// LINHA DO TEMPO & PREVIEW EM TEMPO REAL
function renderTimeline() {
    timelineContainer.innerHTML = '';
    currentProject.images.forEach((img, idx) => {
        const card = document.createElement('div');
        card.className = `timeline-card ${idx === selectedIndex ? 'active' : ''}`;
        card.innerHTML = `
            <img src="${img.url}">
            <button class="btn-del-media" onclick="removeMedia(event, ${idx})">✖</button>
        `;
        card.onclick = () => {
            selectedIndex = idx;
            renderTimeline();
            updatePreviewEffects();
        };
        timelineContainer.appendChild(card);
    });

    if (currentProject.images.length > 0) {
        updatePreviewEffects();
    }
}

function removeMedia(e, idx) {
    e.stopPropagation();
    currentProject.images.splice(idx, 1);
    if (selectedIndex >= currentProject.images.length) selectedIndex = Math.max(0, currentProject.images.length - 1);
    renderTimeline();
    saveCurrentDraft();
}

// APLICAÇÃO DE EFEITOS REAIS VISÍVEIS NO NAVEGADOR
function updatePreviewEffects() {
    const currentMedia = currentProject.images[selectedIndex];
    if (!currentMedia) return;

    previewElement.src = currentMedia.url;
    previewElement.className = ''; // Reseta classes

    // Aplica Animações Ativas em Tempo Real
    if (currentMedia.animation) {
        if (currentMedia.animation === 'Swing') previewElement.classList.add('anim-swing');
        if (currentMedia.animation === 'Pulse') previewElement.classList.add('anim-pulse');
        if (currentMedia.animation === 'Bounce') previewElement.classList.add('anim-bounce');
    }

    // Aplica Zooms Ativos em Tempo Real
    if (currentMedia.zoom) {
        if (currentMedia.zoom === 'Zoom In') previewElement.classList.add('zoom-in');
        if (currentMedia.zoom === 'Zoom Out') previewElement.classList.add('zoom-out');
        if (currentMedia.zoom === 'Esquerda') previewElement.classList.add('zoom-left');
        if (currentMedia.zoom === 'Direita') previewElement.classList.add('zoom-right');
    }
}

// CONTROLE DE PLAY/PAUSE REAL NA LINHA DO TEMPO
btnPlayPause.onclick = () => {
    if (isPlaying) {
        clearInterval(playTimer);
        isPlaying = false;
        btnPlayPause.innerText = '▶️ Play';
    } else {
        isPlaying = true;
        btnPlayPause.innerText = '⏸️ Pausa';
        playTimer = setInterval(() => {
            if (currentProject.images.length === 0) return;
            selectedIndex = (selectedIndex + 1) % currentProject.images.length;
            renderTimeline();
        }, 1500);
    }
};

// ANIMAÇÕES (Ativar / Removendo ao Re-clicar)
function renderAnimationsOptions() {
    const anims = ['Swing', 'Pulse', 'Bounce'];
    const container = document.getElementById('anim-options');
    container.innerHTML = '';
    anims.forEach(anim => {
        const btn = document.createElement('button');
        const isSel = currentProject.images[selectedIndex]?.animation === anim;
        btn.className = `opt-btn ${isSel ? 'active-effect' : ''}`;
        btn.innerText = anim;
        btn.onclick = () => {
            // Se clicar na mesma, remove o efeito!
            currentProject.images[selectedIndex].animation = isSel ? null : anim;
            renderAnimationsOptions();
            updatePreviewEffects();
            saveCurrentDraft();
        };
        container.appendChild(btn);
    });
}

// ZOOMS (Ativar / Removendo ao Re-clicar)
function renderZoomOptions() {
    const zooms = ['Zoom In', 'Zoom Out', 'Esquerda', 'Direita'];
    const container = document.getElementById('zoom-options');
    container.innerHTML = '';
    zooms.forEach(zoom => {
        const btn = document.createElement('button');
        const isSel = currentProject.images[selectedIndex]?.zoom === zoom;
        btn.className = `opt-btn ${isSel ? 'active-effect' : ''}`;
        btn.innerText = zoom;
        btn.onclick = () => {
            // Se clicar na mesma, remove o efeito!
            currentProject.images[selectedIndex].zoom = isSel ? null : zoom;
            renderZoomOptions();
            updatePreviewEffects();
            saveCurrentDraft();
        };
        container.appendChild(btn);
    });
}

// TRANSIÇÕES (20 OPÇÕES COM PRÉ-VISUALIZAÇÃO AUTOMÁTICA)
function renderTransitionsOptions() {
    const container = document.getElementById('transition-options');
    container.innerHTML = '';
    const transitionsList = [
        'Dissolve', 'Fade Cross', 'Push Esq', 'Push Dir', 'Slide Cima',
        'Slide Baixo', 'Blur', 'Zoom Fade', 'Dip Black', 'Dip White',
        'Corte 1', 'Corte 2', 'Diagonal 1', 'Diagonal 2', 'Perspectiva 1',
        'Perspectiva 2', 'Glint Leve', 'Soft Wipe 1', 'Soft Wipe 2', 'Mix Gradual'
    ];

    transitionsList.forEach(name => {
        const btn = document.createElement('button');
        const isSel = selectedTransitions.includes(name);
        btn.className = `opt-btn ${isSel ? 'active-effect' : ''}`;
        btn.innerText = name;
        btn.onclick = () => {
            // Pré-visualização instantânea na imagem
            previewElement.classList.remove('trans-preview');
            void previewElement.offsetWidth; // Trigger reflow
            previewElement.classList.add('trans-preview');

            if (isSel) selectedTransitions = selectedTransitions.filter(t => t !== name);
            else selectedTransitions.push(name);
            
            renderTransitionsOptions();
        };
        container.appendChild(btn);
    });
}

// UPLOAD DE ÁUDIO
document.getElementById('btn-upload-audio').onclick = () => audioInput.click();
audioInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
        data.files.forEach(f => currentProject.audios.push(f.path));
        saveCurrentDraft();
        alert('Áudio adicionado com sucesso!');
    }
};

// EDIÇÃO AUTOMÁTICA REAL VIA WEBSOCKET
document.getElementById('btn-start-auto-edit').onclick = () => {
    document.getElementById('modal-processing').classList.add('active');
    document.getElementById('realtime-logs').innerHTML = '';
    document.getElementById('btn-download-trigger').style.display = 'none';

    socket.emit('start-auto-edit', {
        images: currentProject.images,
        audioFiles: currentProject.audios,
        selectedTransitions,
        projectId: currentProject.id,
        aspectRatio: currentAspect
    });
};

socket.on('edit-progress', (data) => {
    if (data.log) {
        const p = document.createElement('p');
        p.innerText = data.log;
        const logsDiv = document.getElementById('realtime-logs');
        logsDiv.appendChild(p);
        logsDiv.scrollTop = logsDiv.scrollHeight;
    }
    if (data.percent) {
        document.getElementById('progress-percent').innerText = `${data.percent}%`;
    }
});

socket.on('edit-complete', (data) => {
    currentProject.watchUrl = data.watchUrl;
    saveCurrentDraft();
    const trigger = document.getElementById('btn-download-trigger');
    trigger.style.display = 'block';
    trigger.onclick = () => window.location.href = data.watchUrl;
});
