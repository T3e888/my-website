// mission.js (เวอร์ชั่นที่เหมือนตาม PDF, ระบบครบ 3 ด่าน/วัน + countdown, บันทึก progress)

const MISSIONS = [
  {
    title: "ด่าน 1",
    questions: [
      {
        question: "ข้อใดคืออาการที่บ่งบอกว่าอาจเกิด Stroke?",
        choices: ["ตัวร้อน", "ปากเบี้ยว", "หิวข้าว", "ปวดท้อง"],
        answer: 1,
        explain: "อาการปากเบี้ยว คือสัญญาณเตือนสำคัญของ Stroke"
      },
      {
        question: "เบอร์ฉุกเฉินในไทยสำหรับ Stroke คือ?",
        choices: ["191", "112", "1669", "1234"],
        answer: 2,
        explain: "ควรโทร 1669 เพื่อขอรถพยาบาล"
      },
      {
        question: "หากเจอผู้ป่วยพูดไม่ชัด ควร?",
        choices: ["พากลับบ้าน", "ขอให้พูดใหม่", "รีบไปโรงพยาบาล", "ซื้อยาให้"],
        answer: 2,
        explain: "ต้องรีบไปโรงพยาบาลทันที"
      }
    ]
  },
  // เพิ่มด่านที่ 2-12 ตามต้องการ
];

const TOTAL_MISSIONS = 12;
const MISSIONS_PER_DAY = 3;
const RESET_HOURS = 24;

const userKey = (key) => `sh_hero_${key}`;

const $ = s => document.querySelector(s);

const missionGrid = $('#missionGrid');
const missionSelect = $('#mission-select');
const quizBox = $('#quiz-box');
const missionFinish = $('#mission-finish');
const missionTitle = $('#missionTitle');
const quizProgress = $('#quizProgress');
const quizQuestion = $('#quizQuestion');
const quizChoices = $('#quizChoices');
const quizExplain = $('#quizExplain');
const finishDetail = $('#finishDetail');
const resetCountdown = $('#resetCountdown');

let currentMission = null;
let currentQ = 0;
let selected = null;

function getProgress() {
  return JSON.parse(localStorage.getItem(userKey('missions'))) || { finished: [], lastPlayed: null };
}
function setProgress(data) {
  localStorage.setItem(userKey('missions'), JSON.stringify(data));
}

// countdown to reset
function showCountdown() {
  const prog = getProgress();
  if (!prog.lastPlayed) return resetCountdown.textContent = "";
  const last = new Date(prog.lastPlayed);
  const now = new Date();
  const diff = now - last;
  if (diff > RESET_HOURS * 3600 * 1000) return resetCountdown.textContent = "";
  const remain = RESET_HOURS * 3600 * 1000 - diff;
  const h = Math.floor(remain/3600000), m = Math.floor((remain%3600000)/60000), s = Math.floor((remain%60000)/1000);
  resetCountdown.textContent = `สามารถเล่นด่านใหม่ได้อีกครั้งใน ${h} ชั่วโมง ${m} นาที ${s} วินาที`;
  setTimeout(showCountdown, 1000);
}

// แสดงปุ่มด่าน
function renderMissionGrid() {
  missionGrid.innerHTML = "";
  const prog = getProgress();
  let unlocked = MISSIONS_PER_DAY;
  for (let i=0;i<TOTAL_MISSIONS;i++) {
    const btn = document.createElement('button');
    btn.className = 'mission-btn';
    btn.textContent = i+1;
    if (prog.finished.includes(i)) {
      btn.classList.add("done");
      btn.disabled = true;
    } else if (unlocked > 0) {
      btn.classList.add("active");
      btn.onclick = ()=> startMission(i);
      unlocked--;
    } else {
      btn.classList.add("locked");
      btn.disabled = true;
    }
    missionGrid.appendChild(btn);
  }
  showCountdown();
}

function startMission(idx) {
  currentMission = idx;
  currentQ = 0;
  selected = null;
  missionSelect.style.display = 'none';
  quizBox.classList.remove('hidden');
  renderQuestion();
}

function renderQuestion() {
  const m = MISSIONS[currentMission] || MISSIONS[0];
  const q = m.questions[currentQ];
  missionTitle.textContent = m.title;
  quizProgress.textContent = `คำถาม ${currentQ+1}/${m.questions.length}`;
  quizQuestion.textContent = q.question;
  quizChoices.innerHTML = "";
  quizExplain.classList.add('hidden');
  q.choices.forEach((c,i)=>{
    const btn = document.createElement('button');
    btn.className = "choice-btn";
    btn.textContent = c;
    btn.onclick = ()=> selectChoice(i);
    if (selected === i) btn.classList.add('selected');
    quizChoices.appendChild(btn);
  });
  $('#backBtn').disabled = currentQ===0;
  $('#nextBtn').disabled = true;
  $('#checkBtn').disabled = false;
}

function selectChoice(idx) {
  selected = idx;
  Array.from(quizChoices.children).forEach((b,i)=>b.classList.toggle('selected', i===idx));
  $('#nextBtn').disabled = true;
  $('#checkBtn').disabled = false;
}

function checkAnswer() {
  const m = MISSIONS[currentMission] || MISSIONS[0];
  const q = m.questions[currentQ];
  Array.from(quizChoices.children).forEach((b,i)=>{
    b.classList.remove('selected');
    if (i === q.answer) b.classList.add('correct');
    else if (selected === i) b.classList.add('incorrect');
  });
  quizExplain.textContent = q.explain;
  quizExplain.classList.remove('hidden');
  $('#nextBtn').disabled = false;
  $('#checkBtn').disabled = true;
}

function nextQ() {
  const m = MISSIONS[currentMission] || MISSIONS[0];
  if (currentQ < m.questions.length - 1) {
    currentQ++; selected = null; renderQuestion();
  } else finishMission();
}

function finishMission() {
  // save progress
  const prog = getProgress();
  if (!prog.finished.includes(currentMission)) prog.finished.push(currentMission);
  prog.lastPlayed = new Date();
  setProgress(prog);
  quizBox.classList.add('hidden');
  missionFinish.classList.remove('hidden');
  finishDetail.textContent = `คุณผ่านด่านที่ ${currentMission+1} แล้ว! ขณะนี้ผ่านแล้ว ${prog.finished.length}/${TOTAL_MISSIONS} ด่าน`;
  renderMissionGrid();
}

$('#backBtn').onclick = ()=>{
  if (currentQ === 0) {
    quizBox.classList.add('hidden');
    missionSelect.style.display = '';
  } else {
    currentQ--; selected = null; renderQuestion();
  }
};
$('#nextBtn').onclick = nextQ;
$('#checkBtn').onclick = checkAnswer;

// เริ่มต้น
renderMissionGrid();
