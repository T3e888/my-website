firebase.auth().onAuthStateChanged(function(user) {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // === Sidebar Logic ===
  const toggleBtn = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  const closeBtn = document.getElementById("close-sidebar");
  const menuItems = document.querySelectorAll("#sidebar .menu-item");
  const logout = document.getElementById("logout-link");

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.add("open");
    overlay.classList.add("active");
  });
  function closeSidebar() {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  }
  closeBtn.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);

  // Logout with Firebase
  logout.addEventListener("click", function(e) {
    e.preventDefault();
    firebase.auth().signOut().then(() => {
      window.location.href = "login.html";
    });
  });

  menuItems.forEach(item => {
    if (item !== logout) {
      item.addEventListener("click", closeSidebar);
    }
  });

  // === Card Logic ===
  const grid = document.getElementById("cardGrid");
  const modal = document.getElementById("modal");
  const userEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_'); // email-safe localStorage key
  let unlocked = JSON.parse(localStorage.getItem(userEmail + "_cards") || "[]");

  // QR unlock via ?card=cardX
  const params = new URLSearchParams(window.location.search);
  const cardToUnlock = params.get("card");
  if(cardToUnlock && /^card([1-9]|1[0-9]|2[0-5])$/.test(cardToUnlock)) {
    if (!unlocked.includes(cardToUnlock)) {
      unlocked.push(cardToUnlock);
      localStorage.setItem(userEmail + "_cards", JSON.stringify(unlocked));
      showModal(`Unlocked card ${cardToUnlock.replace("card", "")}!`);
    }
    params.delete("card");
    history.replaceState({}, '', window.location.pathname);
  }

  // Build 25 card slots
  grid.innerHTML = "";
  for(let i=1; i<=25; ++i) {
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
    modal.innerHTML = `<div class="modal-content">${msg}<br>
      <button class="modal-close">OK</button></div>`;
    modal.classList.add("active");
    modal.querySelector(".modal-close").onclick = () => {
      modal.classList.remove("active");
    };
  }
});
