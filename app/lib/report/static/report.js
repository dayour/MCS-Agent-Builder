/* MCS Report — Inline Interactivity (Vanilla JS, no framework) */
(function () {
  "use strict";

  // ── Tab switching ────────────────────────────────────────
  var tabBar = document.querySelector(".tab-bar");
  var tabs = document.querySelectorAll(".tab-bar .tab");
  var panels = document.querySelectorAll(".tab-panel");

  if (tabBar && tabs.length && panels.length) {
    // Enable JS-driven tab hiding (no-JS fallback shows all panels)
    document.querySelector(".report-main").classList.add("tabs-enabled");

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.getAttribute("data-tab");

        // Update tab states
        tabs.forEach(function (t) {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");

        // Update panel visibility
        panels.forEach(function (p) {
          p.classList.remove("active");
        });
        var panel = document.getElementById("panel-" + target);
        if (panel) panel.classList.add("active");
      });

      // Keyboard navigation: arrow keys between tabs
      tab.addEventListener("keydown", function (e) {
        var idx = Array.prototype.indexOf.call(tabs, tab);
        var next = -1;
        if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
        if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
        if (next >= 0) {
          e.preventDefault();
          tabs[next].focus();
          tabs[next].click();
        }
      });
    });
  }

  // ── Collapsible sections ──────────────────────────────────
  document.querySelectorAll(".section-heading").forEach(function (heading) {
    heading.addEventListener("click", function () {
      heading.closest("section").classList.toggle("collapsed");
    });
  });

  // ── Print button ──────────────────────────────────────────
  var printBtn = document.getElementById("print-btn");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }
})();
