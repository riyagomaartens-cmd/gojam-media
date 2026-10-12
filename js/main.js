/* Go Jam Media: shared interactions */

/* ============================================================
   CLIENT TESTIMONIALS
   To add a quote, append one object to the array below. Fields:
     quote   (required)  the testimonial text
     name    (required)  who said it
     role    (optional)  e.g. "Artist" or "Founder, Beezlo Boys"
     project (optional)  e.g. "16 Bars music video"
     link    (optional)  URL to the video or project
     photo   (optional)  path to a photo, e.g. "images/photos/x.jpg"
   The section stays hidden while this array is empty.
   Example (leave commented out until it is a REAL quote):
   {
     quote: "They made our release look world-class.",
     name: "Artist Name",
     role: "Artist",
     project: "16 Bars music video",
     link: "https://www.youtube.com/watch?v=-hHR4DKm7Jg"
   }
   ============================================================ */
var GOJAM_TESTIMONIALS = [
  // No live quotes yet. Add real ones here.
];

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

  // --- YouTube click-to-play facades ---
  document.querySelectorAll(".yt-facade").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-id");
      var iframe = document.createElement("iframe");
      iframe.setAttribute(
        "src",
        "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0"
      );
      iframe.setAttribute(
        "allow",
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      );
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("title", btn.getAttribute("aria-label") || "Video");
      btn.replaceWith(iframe);
    });
  });

  // --- client testimonials (render only when the array has entries) ---
  var testiSections = document.querySelectorAll("[data-testimonials]");
  if (testiSections.length && Array.isArray(GOJAM_TESTIMONIALS) && GOJAM_TESTIMONIALS.length) {
    var esc = function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    };
    testiSections.forEach(function (section) {
      var grid = section.querySelector(".testi-grid");
      if (!grid) return;
      grid.innerHTML = "";
      GOJAM_TESTIMONIALS.forEach(function (t) {
        if (!t || !t.quote || !t.name) return;
        var card = document.createElement("article");
        card.className = "testi-card";
        var meta = [t.role, t.project].filter(Boolean).map(esc).join(", ");
        var html = '<p class="testi-quote">' + esc(t.quote) + "</p>";
        html += '<div class="testi-who">';
        if (t.photo) {
          html += '<span class="testi-photo" style="background-image:url(\'' + esc(t.photo) + "')\"></span>";
        }
        html += "<div><span class=\"testi-name\">" + esc(t.name) + "</span>";
        if (meta) html += '<span class="testi-meta">' + meta + "</span>";
        html += "</div></div>";
        if (t.link) {
          html += '<a class="testi-link" href="' + esc(t.link) +
            '" target="_blank" rel="noopener">View project</a>';
        }
        card.innerHTML = html;
        grid.appendChild(card);
      });
      section.hidden = false;
    });
  }

  // --- portfolio filtering ---
  var filterBtns = document.querySelectorAll(".filter-btn");
  if (filterBtns.length) {
    filterBtns.forEach(function (fb) {
      fb.addEventListener("click", function () {
        var f = fb.getAttribute("data-filter");
        filterBtns.forEach(function (b) { b.classList.remove("active"); });
        fb.classList.add("active");
        document.querySelectorAll(".v-card").forEach(function (card) {
          var show = f === "all" || card.getAttribute("data-cat") === f;
          card.classList.toggle("hide", !show);
        });
      });
    });
  }

})();
