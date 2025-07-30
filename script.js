const currentUser = localStorage.getItem('token');
const userCardsKey = currentUser + '_cards';
let unlocked = JSON.parse(localStorage.getItem(userCardsKey) || '{}');
const allCards = ['card1', 'card2'];
const col = document.getElementById('collection');
col.innerHTML = '';

allCards.forEach(key => {
  const cardSlot = document.createElement('div');
  cardSlot.className = 'card-slot';

  const img = document.createElement('img');
  const unlockedCount = unlocked[key] || 0;

  img.src = `assets/cards/${key}${unlockedCount ? '' : '_bw'}.png`;
  img.style.width = '120px';
  img.style.margin = '8px';

  if (!unlockedCount) {
    img.classList.add('locked');
  }

  cardSlot.appendChild(img);

  if (unlockedCount > 1) {
    const countLabel = document.createElement('span');
    countLabel.className = 'count-label';
    countLabel.textContent = `×${unlockedCount}`;
    cardSlot.appendChild(countLabel);
  }

  col.appendChild(cardSlot);
});
