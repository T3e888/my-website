document.addEventListener("DOMContentLoaded", function() {
  // Select elements from the DOM
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar   = document.getElementById("sidebar");
  const overlay   = document.getElementById("overlay");
  const menuItems = document.querySelectorAll("#sidebar .menu-item");

  // Toggle sidebar open/close when hamburger button is clicked
  menuToggle.addEventListener("click", function() {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("active");
  });

  // Close the sidebar when clicking on the overlay outside the menu
  overlay.addEventListener("click", function() {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  });

  // Show an alert and close the sidebar when a menu item is clicked
  menuItems.forEach(function(item) {
    item.addEventListener("click", function(event) {
      event.preventDefault();  // Prevent actual navigation
      alert("คุณคลิกเมนู: " + this.textContent);
      sidebar.classList.remove("open");
      overlay.classList.remove("active");
    });
  });
});
