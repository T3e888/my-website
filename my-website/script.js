// สร้างปุ่มภารกิจ 10 อัน
const missionList = document.getElementById('missionList');
for (let i = 1; i <= 10; i++) {
  const btn = document.createElement('button');
  btn.textContent = `ภารกิจที่ ${i}`;
  btn.style.marginBottom = '10px';
  missionList.appendChild(btn);
}

// ปุ่มรางวัล
const rewardBtn = document.getElementById('rewardBtn');
const rewardKey = 'reward-claimed';

function checkRewardStatus() {
  if (localStorage.getItem(rewardKey) === 'yes') {
    rewardBtn.style.display = 'none';
  }
}

rewardBtn.addEventListener('click', () => {
  alert("🎉 คุณได้รับรางวัลแล้ว!");
  localStorage.setItem(rewardKey, 'yes');
  rewardBtn.style.display = 'none';
});

checkRewardStatus();
