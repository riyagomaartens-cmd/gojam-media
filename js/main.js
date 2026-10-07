/* Go Jam Media — shared interactions */
(function () {
  "use strict";

  // --- mobile nav toggle ---
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    // close menu when a link is tapped
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // --- scroll reveal ---
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  // --- current year in footer ---
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  // --- contact form friendly handling (no backend) ---
  var form = document.querySelector("form[data-contact]");
  if (form) {
    form.addEventListener("submit", function (e) {
      // If the action is still the placeholder, prevent a broken submit
      // and show a helpful message instead.
      if (form.getAttribute("action") === "#" || !form.getAttribute("action")) {
        e.preventDefault();
        var status = form.querySelector(".form-status");
        if (status) {
          status.textContent =
            "Thanks! Your form isn't connected to an inbox yet — set up a free Formspree endpoint (see README) and messages will land in your email.";
          status.style.color = "var(--accent-1)";
        }
      }
    });
  }
})();
