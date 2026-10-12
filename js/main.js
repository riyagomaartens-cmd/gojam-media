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

  // --- animated stat counters ---
  var reduceMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var nums = document.querySelectorAll(".stat .num");
  if (nums.length) {
    var parseNum = function (txt) {
      var m = String(txt).trim().match(/^(\D*)([\d,]*\.?\d+)(.*)$/);
      if (!m) return null;
      var raw = m[2].replace(/,/g, "");
      return {
        prefix: m[1],
        value: parseFloat(raw),
        decimals: (raw.split(".")[1] || "").length,
        suffix: m[3]
      };
    };
    var fmt = function (v, d) {
      return d ? v.toFixed(d) : Math.round(v).toLocaleString();
    };
    var countUp = function (el) {
      var p = parseNum(el.getAttribute("data-count"));
      if (!p) return;
      var dur = 1400, start = null;
      var tick = function (ts) {
        if (start === null) start = ts;
        var t = Math.min((ts - start) / dur, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = p.prefix + fmt(p.value * eased, p.decimals) + p.suffix;
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = p.prefix + fmt(p.value, p.decimals) + p.suffix;
      };
      requestAnimationFrame(tick);
    };
    nums.forEach(function (n) { n.setAttribute("data-count", n.textContent.trim()); });
    if (!reduceMotion && "IntersectionObserver" in window) {
      nums.forEach(function (n) {
        var p = parseNum(n.getAttribute("data-count"));
        if (p) n.textContent = p.prefix + fmt(0, p.decimals) + p.suffix;
      });
      var nio = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            countUp(entry.target);
            nio.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });
      nums.forEach(function (n) { nio.observe(n); });
    }
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
