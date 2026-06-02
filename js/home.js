/* ===================================
   OZZI WEIRD BEATS — Home Page JS
   ================================= */

document.addEventListener('DOMContentLoaded', async () => {
  // Carrega os beats em destaque
  const beats = await fetchFeaturedBeats();
  renderFeaturedBeats(beats);
});

function renderFeaturedBeats(beats) {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  grid.innerHTML = '';

  beats.forEach((beat, index) => {
    const card = createBeatCard(beat, index);
    grid.appendChild(card);
  });
}
