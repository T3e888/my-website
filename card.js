auth.onAuthStateChanged(async function(user) {
  if (!user) return location.href = "login.html";
  const uid = user.uid;
  const docRef = db.collection('users').doc(uid);

  // Load user progress
  let userData = (await docRef.get()).data();
  let unlocked = userData.cards || [];
  const grid = document.getElementById("cardGrid");
  grid.innerHTML = "";
  for (let i = 1; i <= 25; ++i) {
    const cid = "card" + i;
    const div = document.createElement("div");
    div.className = "card " + (unlocked.includes(cid) ? "unlocked" : "locked");
    if (unlocked.includes(cid)) {
      div.style.backgroundImage = `url(assets/cards/${cid}.png)`;
      div.title = `Card ${i}`;
    } else {
      div.innerHTML = `<span class="lock-icon">&#128274;</span>`;
    }
    div.innerHTML += `<span class="card-num">${i}</span>`;
    div.onclick = () => {
      if (unlocked.includes(cid)) {
        showModal(`<img src="assets/cards/${cid}.png" alt="Card ${i}" style="max-width:220px;border-radius:12px;"><div style="margin-top:1em;">Card ${i}</div>`);
      }
    };
    grid.appendChild(div);
  }
  function showModal(msg) {
    const modal = document.getElementById("modal");
    modal.innerHTML = `<div class="modal-content">${msg}<br><button class="modal-close">OK</button></div>`;
    modal.classList.add("active");
    modal.querySelector(".modal-close").onclick = () =>
      modal.classList.remove("active");
  }
});
