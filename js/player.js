/* ===================================
   OZZI WEIRD BEATS — Audio Player
   ===================================
   Player fixo no rodapé (estilo Spotify).
   Persiste o estado entre navegações
   usando localStorage.
   ================================= */

const PLAYER_STATE_KEY = 'ozziWeirdPlayerState';

// Estado interno do player
let playerState = {
  beatId: null,
  beatName: '',
  coverUrl: '',
  mp3Url: '',
  currentTime: 0,
  volume: 0.8,
  isPlaying: false
};

let audioElement = null;
let progressAnimFrame = null;

// ---- Ícones SVG ----
const ICON_PLAY = `<svg class="icon-play" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>`;
const ICON_PAUSE = `<svg class="icon-pause" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const ICON_VOLUME = `<svg viewBox="0 0 24 24"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round"/></svg>`;
const ICON_MUTED = `<svg viewBox="0 0 24 24"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" stroke="none"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

/**
 * Inicializa o player: cria o HTML, o Audio element e restaura estado.
 * Chamar esta função em DOMContentLoaded de todas as páginas.
 */
function initPlayer() {
  // Cria o elemento de áudio
  audioElement = new Audio();
  audioElement.preload = 'metadata';
  audioElement.volume = playerState.volume;

  // Injeta o HTML do player no body
  const playerBar = document.createElement('div');
  playerBar.className = 'player-bar';
  playerBar.id = 'player-bar';
  playerBar.style.display = 'none';
  playerBar.innerHTML = `
    <div class="player-inner">
      <div class="player-info">
        <div class="player-cover" id="player-cover" style="background: var(--bg-tertiary);"></div>
        <div class="player-details">
          <span class="player-name" id="player-name">—</span>
          <span class="player-artist">Ozzi Weird</span>
        </div>
      </div>
      <div class="player-controls">
        <button class="player-play-btn" id="player-play-btn" aria-label="Play/Pause">
          ${ICON_PLAY}
        </button>
        <div class="player-progress">
          <span class="player-time" id="player-current-time">0:00</span>
          <div class="player-progress-bar" id="player-progress-bar">
            <div class="player-progress-fill" id="player-progress-fill"></div>
          </div>
          <span class="player-time" id="player-duration">0:00</span>
        </div>
      </div>
      <div class="player-volume">
        <span id="player-volume-icon">${ICON_VOLUME}</span>
        <input type="range" min="0" max="100" value="80"
               class="player-volume-slider" id="player-volume-slider"
               aria-label="Volume">
      </div>
    </div>
  `;
  document.body.appendChild(playerBar);

  // ---- Referências dos elementos ----
  const playBtn = document.getElementById('player-play-btn');
  const progressBar = document.getElementById('player-progress-bar');
  const volumeSlider = document.getElementById('player-volume-slider');
  const volumeIcon = document.getElementById('player-volume-icon');

  // ---- Event listeners ----
  playBtn.addEventListener('click', togglePlay);

  progressBar.addEventListener('click', (e) => {
    if (!audioElement.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioElement.currentTime = percent * audioElement.duration;
  });

  volumeSlider.addEventListener('input', (e) => {
    const vol = e.target.value / 100;
    setVolume(vol);
  });

  volumeIcon.addEventListener('click', () => {
    if (audioElement.volume > 0) {
      playerState._prevVolume = audioElement.volume;
      setVolume(0);
      volumeSlider.value = 0;
    } else {
      const prev = playerState._prevVolume || 0.8;
      setVolume(prev);
      volumeSlider.value = prev * 100;
    }
  });

  audioElement.addEventListener('ended', () => {
    playerState.isPlaying = false;
    updatePlayButton();
    cancelAnimationFrame(progressAnimFrame);
  });

  audioElement.addEventListener('loadedmetadata', () => {
    document.getElementById('player-duration').textContent =
      formatTime(audioElement.duration);
  });

  // ---- Restaurar estado da página anterior ----
  restorePlayerState();

  // ---- Salvar estado antes de navegar ----
  window.addEventListener('beforeunload', savePlayerState);
}

// Cache de áudio já carregado (evita baixar o mesmo beat duas vezes)
const audioCache = {};

// Fila de prefetch para baixar áudios em segundo plano (Lazy Loading)
const prefetchQueue = [];
let isPrefetching = false;

// Observador para detectar quais beats estão visíveis na tela
let beatObserver = null;
if (typeof IntersectionObserver !== 'undefined') {
  beatObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fileId = entry.target.dataset.driveId;
        if (fileId && !audioCache[fileId] && !audioCache[fileId + '_proxy'] && !prefetchQueue.includes(fileId)) {
          prefetchQueue.push(fileId);
          processPrefetchQueue();
        }
      }
    });
  }, { rootMargin: '200px' }); // Começa a carregar um pouco antes de aparecer
}

// Processa a fila de downloads invisíveis
async function processPrefetchQueue() {
  if (isPrefetching) return;
  isPrefetching = true;
  
  while (prefetchQueue.length > 0) {
    const fileId = prefetchQueue.shift();
    if (audioCache[fileId] || audioCache[fileId + '_proxy']) continue;
    
    try {
      // Baixa via proxy em silêncio
      const res = await fetch(`${API_URL}?action=stream&id=${fileId}`);
      const json = await res.json();
      if (!json.error) {
        const binaryString = atob(json.audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        const blob = new Blob([bytes], { type: json.type || 'audio/mpeg' });
        audioCache[fileId] = URL.createObjectURL(blob);
        audioCache[fileId + '_proxy'] = true;
      }
    } catch (e) {
      // Falha silenciosa no prefetch
    }
  }
  isPrefetching = false;
}

/**
 * Toca um beat. Chamado quando o usuário clica no play de um card.
 */
async function playBeat(beat) {
  const playerBar = document.getElementById('player-bar');
  if (!playerBar || !audioElement) return;

  // Se é o mesmo beat e está tocando, apenas pausa
  if (playerState.beatId === beat.id && playerState.isPlaying) {
    togglePlay();
    return;
  }

  // Atualiza o estado
  playerState.beatId = beat.id;
  playerState.beatName = beat.nome;
  playerState.coverUrl = beat.capa_url;
  playerState.mp3Url = beat.mp3_url;
  playerState.currentTime = 0;

  // Atualiza a UI
  const coverEl = document.getElementById('player-cover');
  if (beat.capa_url) {
    coverEl.style.background = `url('${convertDriveImageUrl(beat.capa_url)}') center/cover`;
  } else {
    coverEl.style.background = getPlaceholderCover(beat.id);
  }
  document.getElementById('player-name').textContent = beat.nome;

  // Mostra o player bar
  playerBar.style.display = 'block';
  document.body.classList.add('player-active');

  // Carrega e toca o áudio
  if (beat.mp3_url) {
    const fileId = extractDriveFileId(beat.mp3_url);
    const dropboxUrl = extractDropboxDirectUrl(beat.mp3_url);
    
    // Mostra estado de carregamento (animação de ondas)
    const playBtn = document.getElementById('player-play-btn');
    playBtn.innerHTML = '<span class="loading-wave"><span></span><span></span><span></span></span>';
    
    try {
      let audioSrc;
      
      if (dropboxUrl) {
        // Link direto do Dropbox (ultra rápido, zero delay)
        audioSrc = dropboxUrl;
      } else if (fileId) {
        // É um link do Google Drive
        if (audioCache[fileId]) {
          // Já carregou antes, usa do cache
          audioSrc = audioCache[fileId];
        } else {
          // Link direto do Google Drive (rápido, sem proxy)
          audioSrc = `https://drive.google.com/uc?export=download&id=${fileId}`;
          audioCache[fileId] = audioSrc;
        }
      } else {
        // Arquivo local ou link externo direto
        audioSrc = beat.mp3_url;
      }
      
      audioElement.src = audioSrc;
      audioElement.currentTime = 0;
      await audioElement.play();
      playerState.isPlaying = true;
    } catch (err) {
      console.warn('Erro ao carregar/tocar áudio:', err);
      
      // Fallback: se o link direto falhou, tenta o proxy base64
      if (fileId && !audioCache[fileId + '_proxy']) {
        try {
          playBtn.innerHTML = '<span class="loading-wave"><span></span><span></span><span></span></span>';
          const res = await fetch(`${API_URL}?action=stream&id=${fileId}`);
          const json = await res.json();
          if (!json.error) {
            const binaryString = atob(json.audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const blob = new Blob([bytes], { type: json.type || 'audio/mpeg' });
            const blobUrl = URL.createObjectURL(blob);
            audioCache[fileId] = blobUrl;
            audioCache[fileId + '_proxy'] = true;
            audioElement.src = blobUrl;
            audioElement.currentTime = 0;
            await audioElement.play();
            playerState.isPlaying = true;
          }
        } catch (proxyErr) {
          console.warn('Fallback proxy também falhou:', proxyErr);
          playerState.isPlaying = false;
        }
      } else {
        playerState.isPlaying = false;
      }
    }
  } else {
    playerState.isPlaying = false;
  }

  updatePlayButton();
  startProgressLoop();
  updatePlayingCards();
}

/**
 * Alterna play/pause.
 */
function togglePlay() {
  if (!audioElement || !audioElement.src) return;

  if (playerState.isPlaying) {
    audioElement.pause();
    playerState.isPlaying = false;
  } else {
    audioElement.play().catch(() => {});
    playerState.isPlaying = true;
  }

  updatePlayButton();

  if (playerState.isPlaying) {
    startProgressLoop();
  } else {
    cancelAnimationFrame(progressAnimFrame);
  }

  updatePlayingCards();
}

/**
 * Define o volume (0–1).
 */
function setVolume(level) {
  if (!audioElement) return;
  audioElement.volume = level;
  playerState.volume = level;

  const icon = document.getElementById('player-volume-icon');
  if (icon) {
    icon.innerHTML = level === 0 ? ICON_MUTED : ICON_VOLUME;
  }
}

/**
 * Atualiza o ícone do botão play/pause.
 */
function updatePlayButton() {
  const btn = document.getElementById('player-play-btn');
  if (!btn) return;
  btn.innerHTML = playerState.isPlaying ? ICON_PAUSE : ICON_PLAY;
}

/**
 * Loop de atualização da barra de progresso (via rAF).
 */
function startProgressLoop() {
  function update() {
    if (!audioElement || !audioElement.duration) {
      progressAnimFrame = requestAnimationFrame(update);
      return;
    }

    const fill = document.getElementById('player-progress-fill');
    const currentTimeEl = document.getElementById('player-current-time');

    if (fill) {
      const pct = (audioElement.currentTime / audioElement.duration) * 100;
      fill.style.width = pct + '%';
    }
    if (currentTimeEl) {
      currentTimeEl.textContent = formatTime(audioElement.currentTime);
    }

    playerState.currentTime = audioElement.currentTime;

    if (playerState.isPlaying) {
      progressAnimFrame = requestAnimationFrame(update);
    }
  }
  cancelAnimationFrame(progressAnimFrame);
  progressAnimFrame = requestAnimationFrame(update);
}

/**
 * Formata segundos em mm:ss.
 */
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Adiciona/remove a classe 'playing' dos cards de beat.
 */
function updatePlayingCards() {
  document.querySelectorAll('.beat-card').forEach(card => {
    const cardId = parseInt(card.dataset.beatId);
    if (cardId === playerState.beatId && playerState.isPlaying) {
      card.classList.add('playing');
    } else {
      card.classList.remove('playing');
    }
  });
}

// ---- Persistência de estado entre páginas ----

function savePlayerState() {
  const state = {
    beatId: playerState.beatId,
    beatName: playerState.beatName,
    coverUrl: playerState.coverUrl,
    mp3Url: playerState.mp3Url,
    currentTime: audioElement ? audioElement.currentTime : 0,
    volume: playerState.volume,
    isPlaying: playerState.isPlaying
  };
  localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
}

function restorePlayerState() {
  try {
    const saved = localStorage.getItem(PLAYER_STATE_KEY);
    if (!saved) return;

    const state = JSON.parse(saved);
    if (!state.beatId) return;

    playerState = { ...playerState, ...state };

    // Restaura a UI
    const playerBar = document.getElementById('player-bar');
    const coverEl = document.getElementById('player-cover');

    if (state.coverUrl) {
      coverEl.style.background = `url('${convertDriveImageUrl(state.coverUrl)}') center/cover`;
    } else {
      coverEl.style.background = getPlaceholderCover(state.beatId);
    }
    document.getElementById('player-name').textContent = state.beatName;

    // Restaura volume
    const volSlider = document.getElementById('player-volume-slider');
    if (volSlider) volSlider.value = state.volume * 100;
    if (audioElement) audioElement.volume = state.volume;

    // Mostra o player
    playerBar.style.display = 'block';
    document.body.classList.add('player-active');

    // Restaura o áudio se estava tocando
    if (state.mp3Url && state.isPlaying) {
      audioElement.src = convertDriveUrl(state.mp3Url);
      audioElement.currentTime = state.currentTime || 0;
      audioElement.play().then(() => {
        playerState.isPlaying = true;
        updatePlayButton();
        startProgressLoop();
        updatePlayingCards();
      }).catch(() => {
        // Autoplay bloqueado — mostra o player pausado
        playerState.isPlaying = false;
        updatePlayButton();
      });
    } else {
      playerState.isPlaying = false;
      updatePlayButton();
      if (audioElement && state.mp3Url) {
        audioElement.src = convertDriveUrl(state.mp3Url);
        audioElement.currentTime = state.currentTime || 0;
      }
      // Atualiza a barra de progresso com a posição salva
      if (audioElement) {
        audioElement.addEventListener('loadedmetadata', () => {
          const fill = document.getElementById('player-progress-fill');
          const currentTimeEl = document.getElementById('player-current-time');
          const durationEl = document.getElementById('player-duration');
          if (fill && audioElement.duration) {
            fill.style.width = ((state.currentTime || 0) / audioElement.duration * 100) + '%';
          }
          if (currentTimeEl) currentTimeEl.textContent = formatTime(state.currentTime || 0);
          if (durationEl) durationEl.textContent = formatTime(audioElement.duration);
        }, { once: true });
      }
    }

    // Limpa o estado salvo (single use)
    localStorage.removeItem(PLAYER_STATE_KEY);
  } catch (err) {
    console.warn('Erro ao restaurar player state:', err);
  }
}

// ---- Inicializar quando a página carrega ----
document.addEventListener('DOMContentLoaded', initPlayer);
