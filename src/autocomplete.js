/* ================================================================
   YTSimple — autocomplete.js

   Wires YouTube search-suggestion autocomplete onto a search input.
   Used by both the homepage overlay and the custom masthead.
   ================================================================ */

(function () {
  "use strict";

  const YTS = (window.__ytsimple = window.__ytsimple || {});

  YTS.setupAutocomplete = function setupAutocomplete(input) {
    let debounceTimer = null;
    let activeIndex = -1;

    // Create dropdown container as a sibling of the input's form
    const dropdown = document.createElement("div");
    dropdown.className = "ytsimple-ac-dropdown";
    input.parentElement.style.position = "relative";
    input.parentElement.appendChild(dropdown);

    function hide() {
      dropdown.classList.remove("ytsimple-show");
      activeIndex = -1;
    }

    function show() {
      if (dropdown.children.length > 0) {
        dropdown.classList.add("ytsimple-show");
      }
    }

    function updateActive() {
      const items = dropdown.querySelectorAll(".ytsimple-ac-item");
      items.forEach((el, i) => {
        el.classList.toggle("ytsimple-ac-active", i === activeIndex);
      });
    }

    function fetchSuggestions(query) {
      if (!query.trim()) { hide(); return; }

      fetch("https://clients1.google.com/complete/search?client=youtube&ds=yt&q=" + encodeURIComponent(query))
        .then((res) => res.text())
        .then((text) => {
          // Response is JSONP: window.google.ac.h([...])
          // Extract the JSON array inside the callback
          const start = text.indexOf("(");
          const end = text.lastIndexOf(")");
          if (start === -1 || end === -1) return;
          const data = JSON.parse(text.substring(start + 1, end));
          const suggestions = (data[1] || []).map((s) => s[0]);

          dropdown.innerHTML = "";
          activeIndex = -1;

          suggestions.forEach((s) => {
            const item = document.createElement("div");
            item.className = "ytsimple-ac-item";
            item.textContent = s;
            item.addEventListener("mousedown", (e) => {
              e.preventDefault();
              input.value = s;
              hide();
              input.closest("form").submit();
            });
            dropdown.appendChild(item);
          });

          show();
        })
        .catch(() => {});
    }

    input.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchSuggestions(input.value), 150);
    });

    input.addEventListener("keydown", (e) => {
      const items = dropdown.querySelectorAll(".ytsimple-ac-item");
      if (!items.length || !dropdown.classList.contains("ytsimple-show")) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        updateActive();
        input.value = items[activeIndex].textContent;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        updateActive();
        input.value = items[activeIndex].textContent;
      } else if (e.key === "Escape") {
        hide();
      }
    });

    input.addEventListener("focus", () => {
      if (input.value.trim()) fetchSuggestions(input.value);
    });

    input.addEventListener("blur", hide);
  };
})();
