/* MCS Report — Inline Interactivity (Vanilla JS, no framework) */
(function () {
  "use strict";

  // ── Collapsible sections ──────────────────────────────────
  document.querySelectorAll(".section-heading").forEach(function (heading) {
    heading.addEventListener("click", function () {
      heading.closest("section").classList.toggle("collapsed");
    });
  });

  // ── Sticky TOC highlight ──────────────────────────────────
  var tocLinks = document.querySelectorAll(".toc a");
  var sections = document.querySelectorAll("section[id]");

  if (tocLinks.length && sections.length && "IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          tocLinks.forEach(function (a) { a.classList.remove("active"); });
          var target = document.querySelector('.toc a[href="#' + entry.target.id + '"]');
          if (target) target.classList.add("active");
        }
      });
    }, { rootMargin: "-20% 0px -75% 0px" });

    sections.forEach(function (s) { observer.observe(s); });
  }

  // ── Print button ──────────────────────────────────────────
  var printBtn = document.getElementById("print-btn");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }

  // ── Smooth scroll for TOC links ───────────────────────────
  tocLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      var href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        var target = document.getElementById(href.slice(1));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  });
})();
