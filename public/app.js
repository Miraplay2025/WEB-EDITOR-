const socket = io();

let savedProjects = JSON.parse(localStorage.getItem('studio_projects') || '[]');
let currentProject = null;
let selectedImageIndex = 0;
let isSelectionModeTransitions = false;
let selectedTransitions = [];
let isPlaying = false;
let playInterval = null;

const splash = document.getElementById('splash-screen');
const mediaInput = document.getElementById('media-input');
const audioInput = document.getElementById('audio-input');
const timelineTracks = document.getElementById('timeline-tracks');
const previewImage = document.getElementById('preview-image');
const previewWrapper = document.getElementById('preview-wrapper');
const aspectRatioSelect = document.getElementById('aspect-ratio');

// Splash Screen
setTimeout(() => {
    splash.style.opacity = '0';
    setTimeout(() => splash.style.display = 'none', 400);
    renderDashboard();
}, 600);

// NAVEGAÇÃO DE SUBVIEWS (Substituição sem conflito)
function showSubview(viewId) {
    document.querySelectorAll('.subview').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

document.getElementById('open-anim-btn').onclick = () => showSubview('view-animations');
document.getElementById('open-zoom-btn').onclick = () => showSubview('view-zoom');
document.getElementById('open-trans-btn').onclick = () => showSubview('view-transitions');
document.getElementById('open-audio-btn').onclick = () => showSubview('view-audio');

document.querySelectorAll('.btn-back-tool').forEach(btn => {
    btn.onclick = () => showSubview('view-timeline');
});

// PROPORÇÃO DINÂMICA
aspectRatioSelect.onchange = (e) => {
    const val = e.target.value;
    previewWrapper.className = '';
    if (val === '9:16') previewWrapper.className = 'aspect-9-16';
    else if (val === '16:9') previewWrapper.className = 'aspect-16-9';
    else if (val === '1:1') previewWrapper.className = 'aspect-1-1';
    else if (val === '4:5') previewWrapper.className = 'aspect-4-5';
};

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
                <p style="font-size:0.8rem; color:#aaa; margin:5px 0;">Mídias: ${proj.images.length}</p>
                ${proj.watchUrl ? `<a href="${proj.watchUrl}" class="btn-success" style="display:inline-block; margin-top:5px; text-decoration:none;">▶️ Assistir</a>` : ''}
                <button class="btn-danger" style="margin-top:5px;" onclick="deleteProject(${idx})">Excluir</button>
            `;
            grid.appendChild(card);
        });
    }
}

function deleteProject(idx) {
    savedProjects.splice(idx, 1);
    localStorage.setItem('studio_projects', JSON.stringify(savedProjects));
    renderDashboard();
}

// CRIAR NOVO PROJETO
document.getElementById('btn-new-project').onclick = () => mediaInput.click();

mediaInput.onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (data.success) {
        currentProject = {
            id: Date.now(),
            images: data.files.map(f => ({ url: f.path, animation: null, zoom: null })),
            audios: [],
            watchUrl: null
        };
        saveCurrentDraft();
        openEditor();
    }
};

function saveCurrentDraft() {
    const idx = savedProjects.findIndex(p => p.id === currentProject.id);
    if (idx >= 0) savedProjects[idx] = currentProject;
    else savedProjects.push(currentProject);
    localStorage.setItem('studio_projects', JSON.stringify(savedProjects));
}

function openEditor() {
    document.getElementById('dashboard-view').classList.remove('active');
    document.getElementById('editor-view').classList.add('active');
    selectedImageIndex = 0;
    renderTimeline();
    renderAnimationsOptions();
    renderZoomOptions();
    renderTransitionsOptions();
    showSubview('view-timeline');
}

document.getElementById('btn-back-dash').onclick = () => {
    saveCurrentDraft();
    document.getElementById('editor-view').classList.remove('active');
    document.getElementById('dashboard-view').classList.add('active');
    renderDashboard();
};

// TIMELINE & PREVIEW
function renderTimeline() {
    timelineTracks.innerHTML = '';
    currentProject.images.forEach((img, idx) => {
        const item = document.createElement('div');
        item.className = `timeline-item ${idx === selectedImageIndex ? 'active' : ''}`;
        item.innerHTML = `<img src="${img.url}">`;
        item.onclick = () => {
            selectedImageIndex = idx;
            renderTimeline();
            renderAnimationsOptions();
            renderZoomOptions();
            previewImage.src = img.url;
        };
        timelineTracks.appendChild(item);
    });
    if (currentProject.images.length > 0) {
        previewImage.src = currentProject.images[selectedImageIndex].url;
    }
}

// CONTROLES DE PLAY/PAUSE SIMULADOS NA TIMELINE
const btnPlayPause = document.getElementById('btn-play-pause');
btnPlayPause.onclick = () => {
    if (isPlaying) {
        clearInterval(playInterval);
        isPlaying = false;
        btnPlayPause.innerText = '▶️';
    } else {
        isPlaying = true;
        btnPlayPause.innerText = '⏸️';
        playInterval = setInterval(() => {
            selectedImageIndex = (selectedImageIndex + 1) % currentProject.images.length;
            renderTimeline();
        }, 1500);
    }
};

document.getElementById('btn-next-frame').onclick = () => {
    if (selectedImageIndex < currentProject.images.length - 1) {
        selectedImageIndex++;
        renderTimeline();
    }
};

document.getElementById('btn-prev-frame').onclick = () => {
    if (selectedImageIndex > 0) {
        selectedImageIndex--;
        renderTimeline();
    }
};

// 10 ANIMAÇÕES
function renderAnimationsOptions() {
    const anims = ['Swing1', 'Swing2', 'Shrink1', 'Shrink2', 'Yo-yo1', 'Yo-yo2', 'FadeIn', 'FadeOut', 'Bounce', 'Pulse'];
    const container = document.getElementById('anim-options');
    container.innerHTML = '';
    anims.forEach(anim => {
        const div = document.createElement('div');
        const isSel = currentProject.images[selectedImageIndex]?.animation === anim;
        div.className = `option-item ${isSel ? 'selected' : ''}`;
        div.innerText = anim;
        div.onclick = () => {
            currentProject.images[selectedImageIndex].animation = isSel ? null : anim;
            renderAnimationsOptions();
            saveCurrentDraft();
        };
        container.appendChild(div);
    });
}

// 10 ZOOMS
function renderZoomOptions() {
    const zooms = ['Zoom In', 'Zoom Out', 'Left', 'Right', 'Up', 'Down', 'Top-Left', 'Top-Right', 'Bottom-Left', 'Bottom-Right'];
    const container = document.getElementById('zoom-options');
    container.innerHTML = '';
    zooms.forEach(zoom => {
        const div = document.createElement('div');
        const isSel = currentProject.images[selectedImageIndex]?.zoom === zoom;
        div.className = `option-item ${isSel ? 'selected' : ''}`;
        div.innerText = zoom;
        div.onclick = () => {
            currentProject.images[selectedImageIndex].zoom = isSel ? null : zoom;
            renderZoomOptions();
            saveCurrentDraft();
        };
        container.appendChild(div);
    });
}

// 20 TRANSIÇÕES
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
        const div = document.createElement('div');
        const isSel = selectedTransitions.includes(name);
        div.className = `option-item ${isSel ? 'selected' : ''}`;
        div.innerText = name;
        div.onclick = () => {
            if (isSelectionModeTransitions) {
                if (isSel) selectedTransitions = selectedTransitions.filter(t => t !== name);
                else selectedTransitions.push(name);
                renderTransitionsOptions();
            } else {
                alert(`Testando pré-visualização da ${name}`);
            }
        };
        container.appendChild(div);
    });
}

document.getElementById('btn-toggle-select-trans').onclick = function() {
    isSelectionModeTransitions = !isSelectionModeTransitions;
    this.innerText = `Modo Seleção: ${isSelectionModeTransitions ? 'ON' : 'OFF'}`;
    this.className = isSelectionModeTransitions ? 'btn-success' : 'btn-secondary';
};

// ÁUDIO
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
        alert('Áudio adicionado!');
    }
};

// EDIÇÃO AUTOMÁTICA
document.getElementById('btn-start-auto-edit').onclick = () => {
    if (selectedTransitions.length === 0) {
        alert("Atenção: Selecione pelo menos 1 transição suave!");
        return;
    }

    document.getElementById('modal-processing').classList.add('active');
    document.getElementById('realtime-logs').innerHTML = '';
    document.getElementById('btn-download-trigger').style.display = 'none';

    socket.emit('start-auto-edit', {
        images: currentProject.images,
        audioFiles: currentProject.audios,
        selectedTransitions,
        projectId: currentProject.id
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
    trigger.style.display = 'inline-block';
    trigger.onclick = () => {
        window.location.href = data.watchUrl;
    };
});
