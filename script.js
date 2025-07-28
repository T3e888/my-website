const unlocked = JSON.parse(localStorage.getItem('unlockedCards')||'[]');
const col = document.getElementById('collection');

unlocked.forEach(key => {
  const img = document.createElement('img');
  img.src = `assets/cards/${key}.png`;
  img.style.width = '120px';
  img.style.margin = '8px';
  col.appendChild(img);
});
