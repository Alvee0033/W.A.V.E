function initCommunity() {
  const grid = document.getElementById('communityGrid');
  const searchInput = document.getElementById('communitySearch');
  const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));
  if (!grid) return;

  // Join buttons toggle
  grid.querySelectorAll('.join-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const joined = btn.classList.toggle('joined');
      btn.textContent = joined ? 'Joined' : 'Join';
    });
  });

  // Tag filter
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tag = btn.getAttribute('data-filter');
      const cards = Array.from(grid.querySelectorAll('.community-card'));
      cards.forEach(card => {
        const cardTags = (card.getAttribute('data-tags') || '').split(/\s+/);
        const show = tag === 'all' || cardTags.includes(tag);
        card.style.display = show ? '' : 'none';
      });
    });
  });

  // Search filter
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      const cards = Array.from(grid.querySelectorAll('.community-card'));
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initCommunity());
} else {
  initCommunity();
}