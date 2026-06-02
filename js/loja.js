/* ===================================
   OZZI WEIRD BEATS — Loja Page JS
   ================================= */

let allBeats = [];

document.addEventListener('DOMContentLoaded', async () => {
  showLoading();

  allBeats = await fetchBeats();
  renderBeats(allBeats);

  // Busca
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', applyFilters);

  // Filtro de gênero
  const genreFilter = document.getElementById('genre-filter');
  genreFilter.addEventListener('change', applyFilters);

  // Filtro de BPM
  const bpmFilter = document.getElementById('bpm-filter');
  bpmFilter.addEventListener('change', applyFilters);

  // Filtro de Favoritos
  const btnFavorites = document.getElementById('btn-toggle-favorites');
  if (btnFavorites) {
    btnFavorites.addEventListener('click', () => {
      window.showingFavoritesOnly = !window.showingFavoritesOnly;
      if (window.showingFavoritesOnly) {
        btnFavorites.style.background = 'var(--accent)';
        btnFavorites.style.color = '#000';
      } else {
        btnFavorites.style.background = 'transparent';
        btnFavorites.style.color = 'var(--text-secondary)';
      }
      applyFilters();
    });
  }

  // Popula o filtro de gêneros com valores únicos
  populateGenreFilter();
});

function showLoading() {
  const grid = document.getElementById('beats-grid');
  grid.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    grid.innerHTML += `
      <div class="skeleton-beat-card">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton-body">
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text-sm"></div>
        </div>
      </div>
    `;
  }
}

function populateGenreFilter() {
  const genreFilter = document.getElementById('genre-filter');
  const genres = [...new Set(allBeats.map(b => b.genero).filter(Boolean))];
  genres.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    genreFilter.appendChild(opt);
  });
}

function applyFilters() {
  const search = document.getElementById('search-input').value.toLowerCase().trim();
  const genre = document.getElementById('genre-filter').value;
  const bpmRange = document.getElementById('bpm-filter').value;

  let filtered = allBeats;

  // Filtro de Favoritos
  if (window.showingFavoritesOnly) {
    const favs = getFavorites();
    filtered = filtered.filter(b => favs.includes(b.id));
  }

  // Filtro de busca (nome ou type beat)
  if (search) {
    filtered = filtered.filter(b =>
      b.nome.toLowerCase().includes(search) ||
      (b.type_beat && b.type_beat.toLowerCase().includes(search))
    );
  }

  // Filtro de gênero
  if (genre) {
    filtered = filtered.filter(b => b.genero === genre);
  }

  // Filtro de BPM
  if (bpmRange) {
    const [min, max] = bpmRange.split('-').map(Number);
    filtered = filtered.filter(b => b.bpm >= min && b.bpm <= max);
  }

  renderBeats(filtered);
}

function renderBeats(beats) {
  const grid = document.getElementById('beats-grid');
  const countEl = document.getElementById('beats-count');

  grid.innerHTML = '';

  if (countEl) {
    countEl.innerHTML = `<span>${beats.length}</span> beat${beats.length !== 1 ? 's' : ''} encontrado${beats.length !== 1 ? 's' : ''}`;
  }

  if (beats.length === 0) {
    grid.innerHTML = `
      <div class="no-results" style="grid-column: 1 / -1;">
        <div class="no-results-icon">🔇</div>
        <p class="no-results-text">Nenhum beat encontrado com esses filtros.</p>
      </div>
    `;
    return;
  }

  beats.forEach((beat, index) => {
    const card = createBeatCard(beat, index);
    grid.appendChild(card);
  });
}
