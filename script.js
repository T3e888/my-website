document.addEventListener("DOMContentLoaded", function() {
  // Sidebar toggle functionality
  var sidebar = document.querySelector(".sidebar");
  var openBtn = document.getElementById("openSidebarBtn");
  var closeBtn = document.getElementById("closeSidebarBtn");
  if (openBtn) {
    openBtn.addEventListener("click", function() {
      if (sidebar) {
        sidebar.classList.add("active");
      }
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", function() {
      if (sidebar) {
        sidebar.classList.remove("active");
      }
    });
  }

  // Scan button functionality (example implementation)
  var scanBtn = document.getElementById("scanButton");
  if (scanBtn) {
    scanBtn.addEventListener("click", function() {
      alert("Scanning...");
      var resultDiv = document.getElementById("scanResult");
      if (resultDiv) {
        resultDiv.textContent = "Scan complete! (demo result)";
      }
      // If using a popup for scan results, you could show it like:
      // var popup = document.querySelector('.popup');
      // if (popup) { popup.classList.add('active'); }
    });
  }

  // Popup close functionality
  var popups = document.querySelectorAll(".popup");
  popups.forEach(function(popup) {
    var popupClose = popup.querySelector(".close");
    if (popupClose) {
      popupClose.addEventListener("click", function() {
        popup.classList.remove("active");
      });
    }
  });
});
