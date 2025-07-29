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
  img.src = `assets/cards/${key}.png`;
  img.style.width = '120px';
  img.style.margin = '8px';

  if (!unlocked[key] || unlocked[key] === 0) {
    img.classList.add('locked');
  }

  cardSlot.appendChild(img);

  if (unlocked[key] && unlocked[key] > 1) {
    const countLabel = document.createElement('span');
    countLabel.className = 'count-label';
    countLabel.textContent = `×${unlocked[key]}`;
    cardSlot.appendChild(countLabel);
  }

  col.appendChild(cardSlot);
});
