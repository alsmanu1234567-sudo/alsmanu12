"use strict";

(() => {
  const toggle = document.getElementById("navToggle");
  const sidebar = document.getElementById("dashboardSidebar");
  const nav = document.getElementById("mainNav");
  const mobile = window.matchMedia("(max-width: 760px)");
  if (!toggle || !sidebar || !nav) return;

  function setOpen(open, returnFocus = false) {
    const visible = mobile.matches && open;
    sidebar.classList.toggle("is-open", visible);
    toggle.setAttribute("aria-expanded", String(visible));
    toggle.setAttribute("aria-label", visible ? "إغلاق قائمة الأقسام" : "فتح قائمة الأقسام");
    if (!visible && returnFocus) toggle.focus();
  }

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true", true);
  });

  nav.addEventListener("click", (event) => {
    if (event.target.closest(".nav-item") && mobile.matches) setOpen(false, true);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false, true);
    }
  });

  mobile.addEventListener("change", (event) => {
    if (!event.matches) setOpen(false);
  });
})();
