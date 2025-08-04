// mission.js

// ตัวอย่างข้อมูลด่านและคำถาม (สำหรับทดสอบ)
const MISSIONS = [
  {
    title: "ด่านที่ 1",
    questions: [
      {
        question: "ข้อใดคืออาการของโรคหลอดเลือดสมอง (Stroke)?",
        choices: ["ปวดหลัง", "ปากเบี้ยว", "ไข้สูง", "ท้องเสีย"],
        answer: 1,
        explain: "ปากเบี้ยว เป็นหนึ่งในอาการสำคัญของโรคหลอดเลือดสมอง"
      },
      {
        question: "สิ่งใดที่ควรทำหากพบคนหมดสติ?",
        choices: ["โทร 1669", "ให้ดื่มน้ำ", "บีบนวดแรงๆ", "ปล่อยไว้เฉยๆ"],
        answer: 0,
        explain: "ควรโทร 1669 เพื่อขอความช่วยเหลือฉุกเฉิน"
      }
    ]
  },
  // ... เพิ่มด่าน 2-12 ตามต้องการ
];

// ตั้งค่าทั่วไป
const TOTAL_MISSIONS = 12;
const QUESTIONS_PER_MISSION = 2; // เปลี่ยนเป็น 5 ถ้ามีข้อมูลจริง
const MISSIONS_PER_DAY = 3;
const RESET_HOURS = 24;

// key สำหรับบันทึก localStorage
const userKey = (key) => `sh_hero_${key}`;

// UI อ้างอิง
const missionsContainer = document.querySelector('.missions');
const quizZone = document.getElementById('quiz-zone');
const missionSelect = document.getElementById('mission-select');
const quizFinish = document.getElementById('quiz-finish');
const quizTitle = document.getElementById('quizTitle');
const quizProgress = document.getElementById('quizProgress');
const quizQuestion = document.getElementById('quizQuestion');
const quizChoices = document.getElementById('quizChoices');
const quizExplain = document.getElementById('quizExplain');
const finishText = document.getElementById('finishText');
const resetInfo = document.getElementById('resetInfo');

let currentMission = null;
let currentQuestion = 0;
let selectedChoice = null;
let isFinished = false;

// โหลดสถานะจาก localStorage
function getProgress() {
  return JSON.parse(localStorage.getItem(userKey('missions'))) || { finished: [], lastPlayed: null };
}
function setProgress(data) {
  localStorage.setItem(userKey('missions'), JSON.stringify(data));
}

// คำนวณเวลาถอยหลัง
function getResetTime() {
  const progress = getProgress();
  if (!progress.lastPlayed) return null;
  const last = new Date(progress.lastPlayed);
  const now = new Date();
  const diff = now - last;
  if (diff > RESET_HOURS * 3600 * 1000) return null;
  return RESET_HOURS * 3600 * 1000 - diff;
}
function showResetTimer() {
  const timeLeft = getResetTime();
  if (timeLeft) {
    const hours = Math.floor(timeLeft / 3600000);
    const mins = Math.floor((timeLeft % 3600000) / 60000);
    const secs = Math.floor((timeLeft % 60000) / 1000);
    resetInfo.textContent = `คุณจะสามารถเล่นด่านใหม่ได้อีกครั้งใน ${hours} ชั่วโมง ${mins} นาที ${secs} วินาที`;
    setTimeout(showResetTimer, 1000);
  } else {
    resetInfo.textContent = "";
    renderMissionSelect();
  }
}

// แสดงปุ่มเลือกด่าน
function renderMissionSelect() {
  missionsContainer.innerHTML = "";
  const progress = getProgress();
  let available = MISSIONS_PER_DAY;
  for (let i = 0; i < TOTAL_MISSIONS; i++) {
    const btn = document.createElement('button');
    btn.className = "mission-btn";
    btn.textContent = i + 1;
    if (progress.finished.includes(i)) {
      btn.classList.add("done");
      btn.disabled = true;
    } else if (available > 0) {
      btn.classList.add("today");
      btn.onclick = () => startMission(i);
      available--;
    } else {
      btn.classList.add("locked");
      btn.disabled = true;
    }
    missionsContainer.appendChild(btn);
  }
  showResetTimer();
}

// เริ่มเล่นด่าน
function startMission(missionIdx) {
  currentMission = missionIdx;
  currentQuestion = 0;
  selectedChoice = null;
  isFinished = false;
  missionSelect.classList.add('hidden');
  quizZone.classList.remove('hidden');
  renderQuestion();
}

// แสดงคำถาม
function renderQuestion() {
  const mission = MISSIONS[currentMission] || MISSIONS[0];
  const q = mission.questions[currentQuestion];
  quizTitle.textContent = `${mission.title}`;
  quizProgress.textContent = `ข้อที่ ${currentQuestion + 1} / ${mission.questions.length}`;
  quizQuestion.textContent = q.question;
  quizChoices.innerHTML = "";
  quizExplain.classList.add('hidden');
  q.choices.forEach((choice, i) => {
    const btn = document.createElement('button');
    btn.className = "choice-btn";
    btn.textContent = choice;
    btn.onclick = () => selectChoice(i);
    if (selectedChoice === i) btn.classList.add('selected');
    quizChoices.appendChild(btn);
  });
  document.getElementById('backBtn').disabled = currentQuestion === 0;
  document.getElementById('nextBtn').disabled = true;
  document.getElementById('submitBtn').disabled = false;
}

// เลือกคำตอบ
function selectChoice(i) {
  selectedChoice = i;
  Array.from(quizChoices.children).forEach((btn, idx) => {
    btn.classList.toggle('selected', idx === i);
  });
  document.getElementById('nextBtn').disabled = true;
  document.getElementById('submitBtn').disabled = false;
}

// ตรวจคำตอบ
function submitAnswer() {
  const mission = MISSIONS[currentMission] || MISSIONS[0];
  const q = mission.questions[currentQuestion];
  Array.from(quizChoices.children).forEach((btn, idx) => {
    btn.classList.remove('selected');
    if (idx === q.answer) btn.classList.add('correct');
    else if (selectedChoice === idx) btn.classList.add('incorrect');
  });
  quizExplain.textContent = q.explain;
  quizExplain.classList.remove('hidden');
  document.getElementById('nextBtn').disabled = false;
  document.getElementById('submitBtn').disabled = true;
}

// ข้ามไปข้อถัดไป
function nextQuestion() {
  const mission = MISSIONS[currentMission] || MISSIONS[0];
  if (currentQuestion < mission.questions.length - 1) {
    currentQuestion++;
    selectedChoice = null;
    renderQuestion();
  } else {
    finishMission();
  }
}

// จบภารกิจ
function finishMission() {
  // Save progress
  const progress = getProgress();
  if (!progress.finished.includes(currentMission)) progress.finished.push(currentMission);
  progress.lastPlayed = new Date();
  setProgress(progress);
  quizZone.classList.add('hidden');
  quizFinish.classList.remove('hidden');
  finishText.textContent = `คุณผ่านด่านที่ ${currentMission + 1} แล้ว! ทำได้ ${progress.finished.length} / ${TOTAL_MISSIONS} ด่าน`;
  renderMissionSelect();
}

// กลับไปเลือกด่าน
document.getElementById('backBtn').onclick = function() {
  if (currentQuestion === 0) {
    quizZone.classList.add('hidden');
    missionSelect.classList.remove('hidden');
  } else {
    currentQuestion--;
    selectedChoice = null;
    renderQuestion();
  }
};
document.getElementById('nextBtn').onclick = nextQuestion;
document.getElementById('submitBtn').onclick = submitAnswer;

// Slidebar logic
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
document.getElementById('menuBtn').onclick = function() {
  sidebar.classList.add('open');
  overlay.classList.add('open');
};
document.getElementById('close
