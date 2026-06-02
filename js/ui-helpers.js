/* ===================================
   OZZI WEIRD BEATS — Shared UI Helpers
   ===================================
   Funções compartilhadas para criar
   componentes HTML reutilizáveis.
   ================================= */

// SVG Icons
const ICONS = {
  play: `<svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>`,
  cart: `<svg viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" stroke-linecap="round"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  x: `<svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trash: `<svg viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19.1c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z"/><polygon points="9.75,15.02 15.5,11.75 9.75,8.48" fill="#000"/></svg>`,
  twitter: `<svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
  heartFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`
};

// ==========================================
// SISTEMA DE FAVORITOS (Local Storage)
// ==========================================
function getFavorites() {
  const favs = localStorage.getItem('ozziWeirdFavorites');
  return favs ? JSON.parse(favs) : [];
}

function isFavorite(beatId) {
  return getFavorites().includes(beatId);
}

function toggleFavorite(beatId, btnElement) {
  let favs = getFavorites();
  const index = favs.indexOf(beatId);
  
  if (index === -1) {
    favs.push(beatId);
    btnElement.innerHTML = ICONS.heartFilled;
    btnElement.classList.add('active');
  } else {
    favs.splice(index, 1);
    btnElement.innerHTML = ICONS.heart;
    btnElement.classList.remove('active');
  }
  
  localStorage.setItem('ozziWeirdFavorites', JSON.stringify(favs));
  
  // Se estivermos na página de loja e o filtro de favoritos estiver ativo, remove o card da tela
  if (window.showingFavoritesOnly && index !== -1) {
    const card = document.querySelector(`.beat-card[data-beat-id="${beatId}"]`);
    if (card) {
      card.style.display = 'none';
    }
  }
}

/**
 * Cria um card de beat como elemento DOM.
 * @param {Object} beat - Dados do beat
 * @param {number} index - Índice para delay da animação
 * @returns {HTMLElement}
 */
function createBeatCard(beat, index) {
  const card = document.createElement('div');
  card.className = 'beat-card';
  card.dataset.beatId = beat.id;
  card.style.animationDelay = `${index * 0.08}s`;

  const inCart = isInCart(beat.id);
  const cartTier = getCartTier(beat.id);
  const favorited = isFavorite(beat.id);

  // Cover image or gradient placeholder
  let coverHtml;
  if (beat.capa_url) {
    coverHtml = `<img src="${convertDriveImageUrl(beat.capa_url)}" alt="${beat.nome}" loading="lazy">`;
  } else {
    coverHtml = `<div style="width:100%;height:100%;background:${getPlaceholderCover(beat.id)};"></div>`;
  }

  let driveId = '';
  if (beat.mp3_url) {
    driveId = extractDriveFileId(beat.mp3_url) || '';
  }

  card.innerHTML = `
    <div class="beat-card-cover" data-drive-id="${driveId}">
      ${coverHtml}
      <button class="btn-favorite ${favorited ? 'active' : ''}" onclick="toggleFavorite(${beat.id}, this)" aria-label="Favoritar" title="Adicionar aos Favoritos">
        ${favorited ? ICONS.heartFilled : ICONS.heart}
      </button>
      <div class="beat-card-play" onclick="playBeat(${JSON.stringify(beat).replace(/"/g, '&quot;')})">
        <div class="beat-card-play-btn">
          ${ICONS.play}
        </div>
      </div>
    </div>
    <div class="beat-card-body">
      <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px;">
        ${beat.type_beat ? `Type ${beat.type_beat}` : 'Original'}
      </div>
      <div class="beat-card-name">${beat.nome}</div>
      <div class="beat-card-meta">
        <span>${beat.bpm} BPM</span>
        <span>${beat.tom}</span>
        ${beat.genero ? `<span>${beat.genero}</span>` : ''}
      </div>
      <div class="beat-card-tiers" style="grid-template-columns: 1fr 1fr;">
        <button class="tier-btn"
                data-tier="mp3" data-beat-id="${beat.id}"
                onclick="selectTier(this, ${beat.id})">
          <span class="tier-btn-label">MP3</span>
          <span class="tier-btn-price">${formatarPreco(beat.preco_mp3)}</span>
        </button>
        <button class="tier-btn"
                data-tier="wav" data-beat-id="${beat.id}"
                onclick="selectTier(this, ${beat.id})">
          <span class="tier-btn-label">WAV</span>
          <span class="tier-btn-price">${formatarPreco(beat.preco_wav)}</span>
        </button>
      </div>
      <div class="beat-card-actions">
        <button class="btn-add-cart ${inCart ? 'in-cart' : ''}"
                id="add-cart-${beat.id}"
                data-beat-id="${beat.id}"
                onclick="handleAddToCart(${beat.id})">
          ${ICONS.cart}
          <span>${inCart ? 'No Carrinho ✓' : 'Selecione um formato'}</span>
        </button>
      </div>
    </div>
  `;

  // Se o beat já está no carrinho, marca o tier correspondente
  if (inCart && cartTier) {
    setTimeout(() => {
      const tierBtn = card.querySelector(`.tier-btn[data-tier="${cartTier}"]`);
      if (tierBtn) tierBtn.classList.add('selected');
    }, 0);
  }

  // Ativa o Lazy Loading / Prefetch para este beat
  if (typeof beatObserver !== 'undefined' && beatObserver && driveId) {
    setTimeout(() => {
      const cover = card.querySelector('.beat-card-cover');
      if (cover) beatObserver.observe(cover);
    }, 100);
  }

  return card;
}

// Tier selecionado por beat (estado temporário na página)
const selectedTiers = {};

/**
 * Seleciona um tier no card do beat.
 */
function selectTier(btn, beatId) {
  // Remove seleção anterior no mesmo card
  const card = btn.closest('.beat-card');
  card.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('selected'));

  // Seleciona este
  btn.classList.add('selected');
  selectedTiers[beatId] = btn.dataset.tier;

  // Ativa o botão de adicionar ao carrinho
  const addBtn = document.getElementById(`add-cart-${beatId}`);
  if (addBtn && !addBtn.classList.contains('in-cart')) {
    addBtn.classList.add('active');
    addBtn.querySelector('span').textContent = 'Adicionar ao Carrinho';
  }
}

/**
 * Manipula o clique no botão "Adicionar ao Carrinho".
 */
async function handleAddToCart(beatId) {
  const tier = selectedTiers[beatId];
  if (!tier) return; // Nenhum tier selecionado

  // Buscar dados completos do beat
  const beats = await fetchBeats();
  const beat = beats.find(b => b.id === beatId);
  if (!beat) return;

  addToCart(beat, tier);

  // Atualiza o botão
  const addBtn = document.getElementById(`add-cart-${beatId}`);
  if (addBtn) {
    addBtn.classList.remove('active');
    addBtn.classList.add('in-cart');
    addBtn.querySelector('span').textContent = 'No Carrinho ✓';
  }
}
