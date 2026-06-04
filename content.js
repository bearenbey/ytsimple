/* ================================================================
   YTSimple — content.js (orchestrator)

   A minimal YouTube experience. This is the entry point; feature logic
   lives in the src/ modules loaded before it:
     • src/helpers.js      — shared utilities (namespace: window.__ytsimple)
     • src/autocomplete.js — search-suggestion autocomplete
     • src/feeds.js        — notifications & subscriptions data
     • src/fabs.js         — floating action buttons & panels

   This file owns:
     1. CSS injection + the enable/disable storage gate
     2. Homepage search overlay
     3. Custom masthead (auto-hides, hover to reveal)
     4. Shorts → watch redirect, channel → /videos redirect
     5. Moving the title above the player on watch pages
     6. SPA navigation handling (yt-navigate-finish)

   Runs at document_start to prevent FOUC.
   ================================================================ */

(function () {
  "use strict";

  const YTS = (window.__ytsimple = window.__ytsimple || {});
  const { $, mount, isHomePage, isWatchPage, setupAutocomplete } = YTS;

  // ----------------------------------------------------------------
  // CSS Injection — inject synchronously to prevent FOUC
  // ----------------------------------------------------------------

  function injectCSS() {
    if ($("ytsimple-styles")) return;
    const link = document.createElement("link");
    link.id = "ytsimple-styles";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("content.css");
    (document.head || document.documentElement).appendChild(link);
  }

  function removeCSS() {
    const el = $("ytsimple-styles");
    if (el) el.remove();
  }

  // Inject CSS immediately (before async storage read) to prevent flash
  injectCSS();

  chrome.storage.local.get("enabled", (data) => {
    if (data.enabled === false) {
      removeCSS();
      return;
    }

    // --------------------------------------------------------------
    // State
    // --------------------------------------------------------------

    let hideTimeout = null;

    // --------------------------------------------------------------
    // Feature 1 — Homepage replacement (search overlay)
    // --------------------------------------------------------------

    function createSearchPage() {
      if ($("ytsimple-home")) return;

      const container = document.createElement("div");
      container.id = "ytsimple-home";
      container.innerHTML = `
        <div class="ytsimple-home-inner">
          <div class="ytsimple-logo">YT<span class="ytsimple-logo-accent">Simple</span></div>
          <form class="ytsimple-search-form" action="/results" method="get">
            <input
              type="text"
              name="search_query"
              class="ytsimple-search-input"
              placeholder="Search YouTube"
              autocomplete="off"
              autofocus
            />
          </form>
        </div>
      `;
      mount(container);
      setupAutocomplete(container.querySelector(".ytsimple-search-input"));
    }

    function removeSearchPage() {
      const el = $("ytsimple-home");
      if (el) el.remove();
    }

    // --------------------------------------------------------------
    // Feature 2 — Custom YTSimple masthead
    // --------------------------------------------------------------

    function createMasthead() {
      if ($("ytsimple-masthead")) return;

      const bar = document.createElement("div");
      bar.id = "ytsimple-masthead";
      bar.innerHTML = `
        <div id="ytsimple-masthead-logo">YT<span>Simple</span></div>
        <form id="ytsimple-masthead-form" action="/results" method="get">
          <input
            type="text"
            name="search_query"
            id="ytsimple-masthead-search"
            placeholder="Search"
            autocomplete="off"
          />
        </form>
      `;
      mount(bar);
      setupAutocomplete(bar.querySelector("#ytsimple-masthead-search"));

      // Click logo to go home
      bar.querySelector("#ytsimple-masthead-logo").addEventListener("click", () => {
        window.location.href = "/";
      });
    }

    function showMasthead() {
      const bar = $("ytsimple-masthead");
      if (bar) bar.classList.add("ytsimple-show");
    }

    function hideMasthead() {
      const bar = $("ytsimple-masthead");
      if (bar) bar.classList.remove("ytsimple-show");
    }

    function scheduleHide() {
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(hideMasthead, 2000);
    }

    // --------------------------------------------------------------
    // Feature 4 — Shorts & channel redirects
    // --------------------------------------------------------------

    function redirectShorts() {
      const path = window.location.pathname;
      if (path.startsWith("/shorts/")) {
        const videoId = path.replace("/shorts/", "").split("?")[0];
        window.location.replace("/watch?v=" + videoId);
        return true;
      }
      return false;
    }

    // Redirect channel pages to their /videos tab
    function redirectChannelToVideos() {
      const path = window.location.pathname;
      if ((path.startsWith("/@") || path.startsWith("/channel/")) &&
          !/\/(videos|shorts|streams|playlists|posts|community|about|search)(\/|$)/.test(path)) {
        // Try clicking the Videos tab (instant SPA navigation)
        const videosTab = document.querySelector('[tab-title="Videos"]');
        if (videosTab) {
          videosTab.click();
          return true;
        }
        // Tab not rendered yet, wait for it
        const tabObserver = new MutationObserver(() => {
          const tab = document.querySelector('[tab-title="Videos"]');
          if (tab) {
            tabObserver.disconnect();
            tab.click();
          }
        });
        tabObserver.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => tabObserver.disconnect(), 5000);
        return false;
      }
      return false;
    }

    // --------------------------------------------------------------
    // Mouse-move handler (registered once, works on all pages)
    // --------------------------------------------------------------

    let mouseMoveRegistered = false;

    function registerMouseMoveOnce() {
      if (mouseMoveRegistered) return;
      mouseMoveRegistered = true;

      document.addEventListener("mousemove", (e) => {
        // Show floating buttons when mouse is near bottom-right corner (all pages)
        if (e.clientY > window.innerHeight - 150 && e.clientX > window.innerWidth - 150) {
          YTS.showFabs();
        } else {
          YTS.scheduleFabHide();
        }

        if (isHomePage()) return; // homepage has its own search

        if (e.clientY < 80) {
          clearTimeout(hideTimeout);
          showMasthead();
        } else {
          scheduleHide();
        }
      });
    }

    // --------------------------------------------------------------
    // Feature 5 — Move title above the video player
    // --------------------------------------------------------------

    let titleObserver = null;

    function disconnectTitleObserver() {
      if (titleObserver) {
        titleObserver.disconnect();
        titleObserver = null;
      }
    }

    function moveTitleAbovePlayer() {
      disconnectTitleObserver();

      function tryMove() {
        const player = document.querySelector("ytd-watch-flexy ytd-player#ytd-player");
        const title = document.querySelector("ytd-watch-metadata h1");
        const text = title && title.textContent.trim();

        if (player && text) {
          let wrapper = $("ytsimple-title");
          if (!wrapper) {
            wrapper = document.createElement("div");
            wrapper.id = "ytsimple-title";
            player.parentElement.insertBefore(wrapper, player);
          }
          wrapper.textContent = text;
          title.closest("ytd-watch-metadata").style.display = "none";
          return true;
        }
        return false;
      }

      // Try immediately
      if (tryMove()) return;

      // Watch for DOM changes until the title appears
      titleObserver = new MutationObserver(() => {
        if (tryMove()) disconnectTitleObserver();
      });

      titleObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    // --------------------------------------------------------------
    // Page handler — called on every navigation
    // --------------------------------------------------------------

    function handlePage() {
      // Clean up moved title and observer from previous page
      disconnectTitleObserver();
      const oldTitle = $("ytsimple-title");
      if (oldTitle) oldTitle.remove();
      // Restore hidden metadata if we hid it
      const meta = document.querySelector("ytd-watch-metadata");
      if (meta) meta.style.display = "";

      // Redirects take priority
      if (redirectShorts()) return;
      redirectChannelToVideos();

      // Create custom masthead and floating buttons on all pages (once)
      createMasthead();
      YTS.setupFabs();
      registerMouseMoveOnce();

      // Homepage overlay
      if (isHomePage()) {
        createSearchPage();
        hideMasthead();
        clearTimeout(hideTimeout);
        return;
      }

      // Not on the homepage — tear down the overlay if it exists.
      removeSearchPage();

      // Watch page
      if (isWatchPage()) {
        hideMasthead();
        moveTitleAbovePlayer();
      } else {
        // On search/channel/other pages, show the masthead
        // so search is accessible.
        clearTimeout(hideTimeout);
        showMasthead();
      }
    }

    // --------------------------------------------------------------
    // Bootstrap
    // --------------------------------------------------------------

    // YouTube fires this custom event after every SPA navigation completes.
    document.addEventListener("yt-navigate-finish", handlePage);

    // The content script runs at document_start, so the DOM may not be
    // ready yet.  We handle both cases:
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", handlePage);
    } else {
      handlePage();
    }
  });
})();
