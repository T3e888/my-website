function setupSidebar() {
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
  logout.addEventListener("click", function(e) {
    e.preventDefault();
    auth.signOut().then(() => window.location.href = "login.html");
  });
  menuItems.forEach(item => {
    if (item !== logout) item.addEventListener("click", closeSidebar);
  });
}

auth.onAuthStateChanged(async function(user) {
  if (!user) return location.href = "login.html";
  setupSidebar();

  const docRef = db.collection('users').doc(user.uid);
  let userData = (await docRef.get()).data();
  let unlocked = userData.cards || [];
  const video = document.getElementById("camera");
  const fileInput = document.getElementById("fileInput");
  const modal = document.getElementById("modal");

  function showModal(msg, cb) {
    modal.innerHTML = `<div class="modal-content">${msg}<br>
      <button class="modal-close">OK</button></div>`;
    modal.classList.add("active");
    modal.querySelector(".modal-close").onclick = () => {
      modal.classList.remove("active");
      if (cb) cb();
    };
  }

  function unlockCard(cardID) {
    if (!unlocked.includes(cardID)) {
      unlocked.push(cardID);
      docRef.update({ cards: unlocked }).then(() =>
        showModal(`Unlocked card ${cardID.replace("card", "")}!`, () =>
          location.href = "card.html"
        )
      );
    } else {
      showModal("Card already unlocked!", () => location.href = "card.html");
    }
  }

  function isValidCardPayload(s) {
    return /^card([1-9]|1[0-9]|2[0-5])$/.test(s);
  }

  // Camera: BarcodeDetector or fallback to file input + jsQR
  if ('BarcodeDetector' in window) {
    navigator.mediaDevices.getUserMedia({video: {facingMode:"environment"}})
      .then(stream => {
        video.srcObject = stream;
        video.play();
        const detector = new BarcodeDetector({formats: ['qr_code']});
        const scanInterval = setInterval(async () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
            const barcodes = await detector.detect(canvas);
            if (barcodes.length && isValidCardPayload(barcodes[0].rawValue)) {
              clearInterval(scanInterval);
              video.srcObject.getTracks().forEach(t=>t.stop());
              unlockCard(barcodes[0].rawValue);
            }
          } catch(e){}
        }, 800);
      })
      .catch(err => {
        fileInput.hidden = false;
      });
  } else {
    fileInput.hidden = false;
    fileInput.style.display = "block";
    fileInput.addEventListener("change", function() {
      if (!fileInput.files[0]) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new window.Image();
        img.onload = function() {
          const canvas = document.createElement("canvas");
          canvas.width = img.width; canvas.height = img.height;
          canvas.getContext("2d").drawImage(img, 0, 0, img.width, img.height);
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/jsqr';
          script.onload = () => {
            const imageData = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
            const qrCode = window.jsQR(imageData.data, imageData.width, imageData.height);
            if(qrCode && isValidCardPayload(qrCode.data)) {
              unlockCard(qrCode.data);
            } else {
              showModal("Invalid QR code");
            }
          };
          document.body.appendChild(script);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(fileInput.files[0]);
    });
  }
});
