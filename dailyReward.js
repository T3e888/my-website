// Daily Login Reward Script
const rewardModal = document.getElementById('dailyRewardModal');
const openBtn = document.getElementById('openRewardModalBtn');
const closeBtn = document.getElementById('closeModalBtn');
const claimBtn = document.getElementById('claimRewardBtn');
// Reward definitions for each day
const rewards = {
1: { type: 'points', amount: 2 },             // Day 1: +2 points
2: { type: 'points', amount: 3 },             // Day 2: +3 points
3: { type: 'card', amount: 1 },               // Day 3: 1 event card
4: { type: 'points', amount: 2 },             // Day 4: +2 points
5: { type: 'points', amount: 3 },             // Day 5: +3 points
6: { type: 'points', amount: 2 },             // Day 6: +2 points
7: { type: 'card_points', points: 2, card: 1 } // Day 7: +2 points and 1 event card
};
// Helper to get today's date (YYYY-M-D)
function todayDateStr() {
const d = new Date();
return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}
// Load last claim info from localStorage
let lastClaimDate = localStorage.getItem('dailyLastClaim');
let streakDay = parseInt(localStorage.getItem('dailyStreakDay') || '1');
let currentDay = streakDay;
if (lastClaimDate) {
const today = todayDateStr();
if (today !== lastClaimDate) {
// Check if consecutive day or not
const lastDate = new Date(lastClaimDate);
const diffDays = Math.floor((new Date(today) - lastDate) / (10006060*24));
if (diffDays === 1) {
// Next day in streak
currentDay = streakDay < 7 ? streakDay + 1 : 1;
} else {
// Missed more than one day, reset streak
currentDay = 1;
streakDay = 1;
}
}
} else {
// No previous login, start at day 1
currentDay = 1;
streakDay = 1;
}
function updateRewardUI() {
for (let day = 1; day <= 7; day++) {
const box = document.getElementById('day' + day);
if (!box) continue;
if (day < currentDay) {
box.classList.add('claimed');
} else {
box.classList.remove('claimed');
}
box.classList.remove('current');
}
const currentBox = document.getElementById('day' + currentDay);
if (currentBox) currentBox.classList.add('current');
// Update claim button state
const today = todayDateStr();
if (lastClaimDate === today) {
claimBtn.disabled = true;
claimBtn.textContent = "รับรางวัลแล้ว";  // "Reward received"
} else {
claimBtn.disabled = false;
claimBtn.textContent = "รับรางวัล";
}
}
function openModal() {
updateRewardUI();
rewardModal.style.display = 'flex';
}
function closeModal() {
rewardModal.style.display = 'none';
}
// Event listeners for opening/closing modal
openBtn.addEventListener('click', openModal);
closeBtn.addEventListener('click', closeModal);
// Close modal if clicking outside content
window.addEventListener('click', e => { if (e.target === rewardModal) closeModal(); });
// Claim reward logic
claimBtn.addEventListener('click', () => {
const reward = rewards[currentDay];
if (!reward) return;
// Grant the reward:
if (reward.type === 'points') {
let pts = parseInt(localStorage.getItem('brainPoints') || '0');
pts += reward.amount;
localStorage.setItem('brainPoints', pts);
} else if (reward.type === 'card') {
let cardCount = parseInt(localStorage.getItem('eventCards') || '0');
cardCount += reward.amount;
localStorage.setItem('eventCards', cardCount);
} else if (reward.type === 'card_points') {
// both points and a card
let pts = parseInt(localStorage.getItem('brainPoints') || '0');
pts += reward.points;
localStorage.setItem('brainPoints', pts);
let cardCount = parseInt(localStorage.getItem('eventCards') || '0');
cardCount += reward.card;
localStorage.setItem('eventCards', cardCount);
}
// Mark current day as claimed
lastClaimDate = todayDateStr();
localStorage.setItem('dailyLastClaim', lastClaimDate);
streakDay = currentDay;
localStorage.setItem('dailyStreakDay', String(streakDay));
// Move to next day (or reset if it was day 7)
if (currentDay >= 7) {
currentDay = 1;
streakDay = 1;
localStorage.setItem('dailyStreakDay', '1');
} else {
currentDay++;
}
updateRewardUI();
});
// On page load, show modal if user hasn't claimed today
document.addEventListener('DOMContentLoaded', () => {
const today = todayDateStr();
if (localStorage.getItem('isLoggedIn') === 'true') {  // adjust this check as needed for your login system
if (lastClaimDate !== today) {
openModal();
}
}
});
Should I have to create this file

