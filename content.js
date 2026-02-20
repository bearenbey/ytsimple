/* ================================================================
   YTSimple — content.js

   A minimal YouTube experience. This content script powers:
     1. Homepage → clean search overlay with autocomplete
     2. Watch page → centered player, title above video, no clutter
     3. Custom masthead with search (auto-hides, hover to reveal)
     4. Shorts → regular video redirect
     5. Channel pages → banner & tab cleanup
     6. Floating action buttons (notifications, subs, account)

   Runs at document_start to prevent FOUC. Listens to YouTube's
   yt-navigate-finish event for SPA navigation handling.
   ================================================================ */

(function () {
  "use strict";

  // ----------------------------------------------------------------
  // CSS Injection — inject synchronously to prevent FOUC
  // ----------------------------------------------------------------

  function injectCSS() {
    if (document.getElementById("ytsimple-styles")) return;
    const link = document.createElement("link");
    link.id = "ytsimple-styles";
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("content.css");
    (document.head || document.documentElement).appendChild(link);
  }

  function removeCSS() {
    const el = document.getElementById("ytsimple-styles");
    if (el) el.remove();
  }

  // Inject CSS immediately (before async storage read) to prevent flash
  injectCSS();

  chrome.storage.local.get("enabled", (data) => {
    if (data.enabled === false) {
      removeCSS();
      return;
    }

    // ----------------------------------------------------------------
    // State
    // ----------------------------------------------------------------

    let hideTimeout = null;
    let fabHideTimeout = null;

    // ----------------------------------------------------------------
    // Feature 1 — Homepage replacement (search overlay)
    // ----------------------------------------------------------------

    function isHomePage() {
      return (
        window.location.pathname === "/" ||
        window.location.pathname === "/feed/trending"
      );
    }

    function createSearchPage() {
      const existing = document.getElementById("ytsimple-home");
      if (existing) return;

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
      (document.body || document.documentElement).appendChild(container);
      setupAutocomplete(container.querySelector(".ytsimple-search-input"));
    }

    function removeSearchPage() {
      const el = document.getElementById("ytsimple-home");
      if (el) el.remove();
    }

    // ----------------------------------------------------------------
    // Autocomplete — YouTube search suggestions
    // ----------------------------------------------------------------

    function setupAutocomplete(input) {
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
        items.forEach(function (el, i) {
          el.classList.toggle("ytsimple-ac-active", i === activeIndex);
        });
      }

      function fetchSuggestions(query) {
        if (!query.trim()) { hide(); return; }

        fetch("https://clients1.google.com/complete/search?client=youtube&ds=yt&q=" + encodeURIComponent(query))
          .then(function (res) { return res.text(); })
          .then(function (text) {
            // Response is JSONP: window.google.ac.h([...])
            // Extract the JSON array inside the callback
            var start = text.indexOf("(");
            var end = text.lastIndexOf(")");
            if (start === -1 || end === -1) return;
            var data = JSON.parse(text.substring(start + 1, end));
            var suggestions = (data[1] || []).map(function (s) { return s[0]; });

            dropdown.innerHTML = "";
            activeIndex = -1;

            suggestions.forEach(function (s) {
              var item = document.createElement("div");
              item.className = "ytsimple-ac-item";
              item.textContent = s;
              item.addEventListener("mousedown", function (e) {
                e.preventDefault();
                input.value = s;
                hide();
                input.closest("form").submit();
              });
              dropdown.appendChild(item);
            });

            show();
          })
          .catch(function () {});
      }

      input.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          fetchSuggestions(input.value);
        }, 150);
      });

      input.addEventListener("keydown", function (e) {
        var items = dropdown.querySelectorAll(".ytsimple-ac-item");
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

      input.addEventListener("focus", function () {
        if (input.value.trim()) fetchSuggestions(input.value);
      });

      input.addEventListener("blur", function () {
        hide();
      });
    }

    // ----------------------------------------------------------------
    // Feature 2 — Custom YTSimple masthead
    // ----------------------------------------------------------------

    function createMasthead() {
      if (document.getElementById("ytsimple-masthead")) return;

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
      (document.body || document.documentElement).appendChild(bar);
      setupAutocomplete(bar.querySelector("#ytsimple-masthead-search"));

      // Click logo to go home
      bar.querySelector("#ytsimple-masthead-logo").addEventListener("click", function () {
        window.location.href = "/";
      });
    }

    function showMasthead() {
      const bar = document.getElementById("ytsimple-masthead");
      if (bar) bar.classList.add("ytsimple-show");
    }

    function hideMasthead() {
      const bar = document.getElementById("ytsimple-masthead");
      if (bar) bar.classList.remove("ytsimple-show");
    }

    function scheduleHide() {
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(hideMasthead, 2000);
    }

    function showFabs() {
      var sBtn = document.getElementById("ytsimple-subs-btn");
      var nBtn = document.getElementById("ytsimple-notif-btn");
      var aBtn = document.getElementById("ytsimple-account-btn");
      if (sBtn) sBtn.classList.add("ytsimple-fab-visible");
      if (nBtn) nBtn.classList.add("ytsimple-fab-visible");
      if (aBtn) aBtn.classList.add("ytsimple-fab-visible");
    }

    function hideFabs() {
      // Don't hide if a panel is open
      if (subsPanelOpen || notifPanelOpen || accountPanelOpen) return;
      var sBtn = document.getElementById("ytsimple-subs-btn");
      var nBtn = document.getElementById("ytsimple-notif-btn");
      var aBtn = document.getElementById("ytsimple-account-btn");
      if (sBtn) sBtn.classList.remove("ytsimple-fab-visible");
      if (nBtn) nBtn.classList.remove("ytsimple-fab-visible");
      if (aBtn) aBtn.classList.remove("ytsimple-fab-visible");
    }

    function scheduleFabHide() {
      clearTimeout(fabHideTimeout);
      fabHideTimeout = setTimeout(hideFabs, 2000);
    }

    function isWatchPage() {
      return window.location.pathname === "/watch";
    }

    // ----------------------------------------------------------------
    // Feature 3 — Shorts redirect
    // ----------------------------------------------------------------

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
        var videosTab = document.querySelector('[tab-title="Videos"]');
        if (videosTab) {
          videosTab.click();
          return true;
        }
        // Tab not rendered yet, wait for it
        var tabObserver = new MutationObserver(function () {
          var tab = document.querySelector('[tab-title="Videos"]');
          if (tab) {
            tabObserver.disconnect();
            tab.click();
          }
        });
        tabObserver.observe(document.body, { childList: true, subtree: true });
        setTimeout(function () { tabObserver.disconnect(); }, 5000);
        return false;
      }
      return false;
    }

    // ----------------------------------------------------------------
    // Mouse-move handler (registered once, works on all pages)
    // ----------------------------------------------------------------

    let mouseMoveRegistered = false;

    function registerMouseMoveOnce() {
      if (mouseMoveRegistered) return;
      mouseMoveRegistered = true;

      document.addEventListener("mousemove", function (e) {
        // Show floating buttons when mouse is near bottom-right corner (all pages)
        if (e.clientY > window.innerHeight - 150 && e.clientX > window.innerWidth - 150) {
          clearTimeout(fabHideTimeout);
          showFabs();
        } else {
          scheduleFabHide();
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

    // ----------------------------------------------------------------
    // Feature 4 — Move title above the video player
    // ----------------------------------------------------------------

    let titleObserver = null;

    function moveTitleAbovePlayer() {
      // Clean up any previous observer
      if (titleObserver) {
        titleObserver.disconnect();
        titleObserver = null;
      }

      function tryMove() {
        const player = document.querySelector("ytd-watch-flexy ytd-player#ytd-player");
        const title = document.querySelector("ytd-watch-metadata h1");
        const text = title && title.textContent.trim();

        if (player && text) {
          let wrapper = document.getElementById("ytsimple-title");
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
      titleObserver = new MutationObserver(function () {
        if (tryMove()) {
          titleObserver.disconnect();
          titleObserver = null;
        }
      });

      titleObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    // ----------------------------------------------------------------
    // Feature 5 — Notifications floating button
    // ----------------------------------------------------------------

    let notifPanelOpen = false;
    let notifCache = null;

    function createNotifButton() {
      if (document.getElementById("ytsimple-notif-btn")) return;

      const btn = document.createElement("div");
      btn.id = "ytsimple-notif-btn";
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
      (document.body || document.documentElement).appendChild(btn);

      const panel = document.createElement("div");
      panel.id = "ytsimple-notif-panel";
      panel.innerHTML = `
        <div class="ytsimple-subs-header">Notifications</div>
        <div id="ytsimple-notif-list"></div>
      `;
      (document.body || document.documentElement).appendChild(panel);

      btn.addEventListener("click", function () {
        // Close other panels
        if (subsPanelOpen) {
          subsPanelOpen = false;
          var sp = document.getElementById("ytsimple-subs-panel");
          var sb = document.getElementById("ytsimple-subs-btn");
          if (sp) sp.classList.remove("ytsimple-show");
          if (sb) sb.classList.remove("ytsimple-active");
        }
        if (accountPanelOpen) {
          accountPanelOpen = false;
          var ap = document.getElementById("ytsimple-account-panel");
          var ab = document.getElementById("ytsimple-account-btn");
          if (ap) ap.classList.remove("ytsimple-show");
          if (ab) ab.classList.remove("ytsimple-active");
        }
        notifPanelOpen = !notifPanelOpen;
        panel.classList.toggle("ytsimple-show", notifPanelOpen);
        btn.classList.toggle("ytsimple-active", notifPanelOpen);
        if (notifPanelOpen) loadNotifications();
      });

      document.addEventListener("click", function (e) {
        if (notifPanelOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
          notifPanelOpen = false;
          panel.classList.remove("ytsimple-show");
          btn.classList.remove("ytsimple-active");
          scheduleFabHide();
        }
      });
    }

    function loadNotifications() {
      var list = document.getElementById("ytsimple-notif-list");
      if (!list) return;

      if (notifCache) {
        renderNotifications(notifCache);
        return;
      }

      list.innerHTML = '<div class="ytsimple-subs-empty">Loading...</div>';

      fetch("/feed/notifications")
        .then(function (res) { return res.text(); })
        .then(function (html) {
          var notifs = [];
          var match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
          if (match) {
            try {
              var data = JSON.parse(match[1]);
              var sections = data.contents && data.contents.twoColumnBrowseResultsRenderer &&
                data.contents.twoColumnBrowseResultsRenderer.tabs;
              if (sections) {
                sections.forEach(function (tab) {
                  var items = tab.tabRenderer && tab.tabRenderer.content &&
                    tab.tabRenderer.content.sectionListRenderer &&
                    tab.tabRenderer.content.sectionListRenderer.contents;
                  if (items) {
                    items.forEach(function (section) {
                      var entries = section.itemSectionRenderer && section.itemSectionRenderer.contents;
                      if (entries) {
                        entries.forEach(function (entry) {
                          var notif = entry.notificationRenderer;
                          if (notif) {
                            var text = notif.shortMessage && notif.shortMessage.simpleText || "";
                            var time = notif.sentTimeText && notif.sentTimeText.simpleText || "";
                            var img = notif.thumbnail && notif.thumbnail.thumbnails &&
                              notif.thumbnail.thumbnails[0] && notif.thumbnail.thumbnails[0].url || "";
                            var url = notif.navigationEndpoint &&
                              notif.navigationEndpoint.commandMetadata &&
                              notif.navigationEndpoint.commandMetadata.webCommandMetadata &&
                              notif.navigationEndpoint.commandMetadata.webCommandMetadata.url || "";
                            if (text) {
                              notifs.push({ text: text, time: time, img: img, url: url });
                            }
                          }
                        });
                      }
                    });
                  }
                });
              }
            } catch (e) {}
          }
          notifCache = notifs;
          renderNotifications(notifs);
        })
        .catch(function () {
          list.innerHTML = '<div class="ytsimple-subs-empty">Failed to load</div>';
        });
    }

    function renderNotifications(notifs) {
      var list = document.getElementById("ytsimple-notif-list");
      if (!list) return;

      if (notifs.length === 0) {
        list.innerHTML = '<div class="ytsimple-subs-empty">No notifications</div>';
        return;
      }

      list.innerHTML = notifs.map(function (n) {
        var imgHtml = n.img
          ? '<img class="ytsimple-notif-thumb" src="' + n.img + '" />'
          : '';
        var tag = n.url ? 'a' : 'div';
        var href = n.url ? ' href="' + n.url + '"' : '';
        return '<' + tag + ' class="ytsimple-notif-item"' + href + '>' +
          imgHtml +
          '<div class="ytsimple-notif-text">' +
            '<span class="ytsimple-notif-msg">' + n.text + '</span>' +
            '<span class="ytsimple-notif-time">' + n.time + '</span>' +
          '</div>' +
        '</' + tag + '>';
      }).join("");
    }

    // ----------------------------------------------------------------
    // Feature 6 — Subscriptions floating button
    // ----------------------------------------------------------------

    let subsPanelOpen = false;

    function createSubsButton() {
      if (document.getElementById("ytsimple-subs-btn")) return;

      const btn = document.createElement("div");
      btn.id = "ytsimple-subs-btn";
      btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
      (document.body || document.documentElement).appendChild(btn);

      const panel = document.createElement("div");
      panel.id = "ytsimple-subs-panel";
      panel.innerHTML = `
        <div class="ytsimple-subs-header">Subscriptions</div>
        <div id="ytsimple-subs-list"></div>
      `;
      (document.body || document.documentElement).appendChild(panel);

      btn.addEventListener("click", function () {
        // Close other panels
        if (notifPanelOpen) {
          notifPanelOpen = false;
          var np = document.getElementById("ytsimple-notif-panel");
          var nb = document.getElementById("ytsimple-notif-btn");
          if (np) np.classList.remove("ytsimple-show");
          if (nb) nb.classList.remove("ytsimple-active");
        }
        if (accountPanelOpen) {
          accountPanelOpen = false;
          var ap = document.getElementById("ytsimple-account-panel");
          var ab = document.getElementById("ytsimple-account-btn");
          if (ap) ap.classList.remove("ytsimple-show");
          if (ab) ab.classList.remove("ytsimple-active");
        }
        subsPanelOpen = !subsPanelOpen;
        panel.classList.toggle("ytsimple-show", subsPanelOpen);
        btn.classList.toggle("ytsimple-active", subsPanelOpen);
        if (subsPanelOpen) loadSubscriptions();
      });

      // Close panel on click outside
      document.addEventListener("click", function (e) {
        if (subsPanelOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
          subsPanelOpen = false;
          panel.classList.remove("ytsimple-show");
          btn.classList.remove("ytsimple-active");
          scheduleFabHide();
        }
      });
    }

    let subsCache = null;

    function loadSubscriptions() {
      const list = document.getElementById("ytsimple-subs-list");
      if (!list) return;

      // Use cache if available
      if (subsCache) {
        renderSubs(subsCache);
        return;
      }

      list.innerHTML = '<div class="ytsimple-subs-empty">Loading...</div>';

      // Fetch the subscriptions feed page and parse channel data
      fetch("/feed/channels")
        .then(function (res) { return res.text(); })
        .then(function (html) {
          var subs = [];

          // Extract ytInitialData JSON from the page
          var match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
          if (match) {
            try {
              var data = JSON.parse(match[1]);
              // Navigate the YouTube data structure to find channels
              var tabs = data.contents && data.contents.twoColumnBrowseResultsRenderer &&
                data.contents.twoColumnBrowseResultsRenderer.tabs;
              if (tabs) {
                tabs.forEach(function (tab) {
                  var items = tab.tabRenderer && tab.tabRenderer.content &&
                    tab.tabRenderer.content.sectionListRenderer &&
                    tab.tabRenderer.content.sectionListRenderer.contents;
                  if (items) {
                    items.forEach(function (section) {
                      var shelf = section.itemSectionRenderer && section.itemSectionRenderer.contents;
                      if (shelf) {
                        shelf.forEach(function (item) {
                          var grid = item.shelfRenderer && item.shelfRenderer.content &&
                            item.shelfRenderer.content.expandedShelfContentsRenderer &&
                            item.shelfRenderer.content.expandedShelfContentsRenderer.items;
                          if (!grid) {
                            grid = item.gridRenderer && item.gridRenderer.items;
                          }
                          if (grid) {
                            grid.forEach(function (ch) {
                              var channel = ch.channelRenderer;
                              if (channel) {
                                var name = channel.title && channel.title.simpleText || "";
                                var url = channel.navigationEndpoint &&
                                  channel.navigationEndpoint.browseEndpoint &&
                                  channel.navigationEndpoint.browseEndpoint.canonicalBaseUrl || "";
                                var img = channel.thumbnail && channel.thumbnail.thumbnails &&
                                  channel.thumbnail.thumbnails[0] && channel.thumbnail.thumbnails[0].url || "";
                                if (name && url) {
                                  subs.push({ name: name, url: url, img: img });
                                }
                              }
                            });
                          }
                        });
                      }
                    });
                  }
                });
              }
            } catch (e) {
              // JSON parse failed
            }
          }

          subsCache = subs;
          renderSubs(subs);
        })
        .catch(function () {
          list.innerHTML = '<div class="ytsimple-subs-empty">Failed to load</div>';
        });
    }

    function renderSubs(subs) {
      const list = document.getElementById("ytsimple-subs-list");
      if (!list) return;

      if (subs.length === 0) {
        list.innerHTML = '<div class="ytsimple-subs-empty">No subscriptions found</div>';
        return;
      }

      list.innerHTML = subs.map(function (sub) {
        const imgHtml = sub.img
          ? '<img class="ytsimple-sub-avatar" src="' + sub.img + '" />'
          : '<div class="ytsimple-sub-avatar-placeholder"></div>';
        var subUrl = sub.url.replace(/\/+$/, "") + "/videos";
        return '<a class="ytsimple-sub-item" href="' + subUrl + '">' + imgHtml + '<span>' + sub.name + '</span></a>';
      }).join("");
    }

    // ----------------------------------------------------------------
    // Feature 7 — Account floating button
    // ----------------------------------------------------------------

    let accountPanelOpen = false;

    function createAccountButton() {
      if (document.getElementById("ytsimple-account-btn")) return;

      const btn = document.createElement("div");
      btn.id = "ytsimple-account-btn";
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
      (document.body || document.documentElement).appendChild(btn);

      const panel = document.createElement("div");
      panel.id = "ytsimple-account-panel";
      panel.innerHTML = `
        <a class="ytsimple-account-link" href="/feed/you">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Your channel
        </a>
        <a class="ytsimple-account-link" href="https://studio.youtube.com">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          YouTube Studio
        </a>
        <a class="ytsimple-account-link" href="/account">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Settings
        </a>
      `;
      (document.body || document.documentElement).appendChild(panel);

      btn.addEventListener("click", function () {
        // Close other panels
        if (notifPanelOpen) {
          notifPanelOpen = false;
          var np = document.getElementById("ytsimple-notif-panel");
          var nb = document.getElementById("ytsimple-notif-btn");
          if (np) np.classList.remove("ytsimple-show");
          if (nb) nb.classList.remove("ytsimple-active");
        }
        if (subsPanelOpen) {
          subsPanelOpen = false;
          var sp = document.getElementById("ytsimple-subs-panel");
          var sb = document.getElementById("ytsimple-subs-btn");
          if (sp) sp.classList.remove("ytsimple-show");
          if (sb) sb.classList.remove("ytsimple-active");
        }
        accountPanelOpen = !accountPanelOpen;
        panel.classList.toggle("ytsimple-show", accountPanelOpen);
        btn.classList.toggle("ytsimple-active", accountPanelOpen);
      });

      document.addEventListener("click", function (e) {
        if (accountPanelOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
          accountPanelOpen = false;
          panel.classList.remove("ytsimple-show");
          btn.classList.remove("ytsimple-active");
          scheduleFabHide();
        }
      });
    }

    // ----------------------------------------------------------------
    // Page handler — called on every navigation
    // ----------------------------------------------------------------

    function handlePage() {
      // Clean up moved title and observer from previous page
      if (titleObserver) {
        titleObserver.disconnect();
        titleObserver = null;
      }
      const oldTitle = document.getElementById("ytsimple-title");
      if (oldTitle) oldTitle.remove();
      // Restore hidden metadata if we hid it
      const meta = document.querySelector("ytd-watch-metadata");
      if (meta) meta.style.display = "";

      // Redirects take priority
      if (redirectShorts()) return;
      redirectChannelToVideos();

      // Create custom masthead and floating buttons on all pages (once)
      createMasthead();
      createNotifButton();
      createSubsButton();
      createAccountButton();
      registerMouseMoveOnce();

      // 2. Homepage overlay
      if (isHomePage()) {
        createSearchPage();
        hideMasthead();
        clearTimeout(hideTimeout);
        return;
      }

      // Not on the homepage — tear down the overlay if it exists.
      removeSearchPage();

      // 3. Watch page
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

    // ----------------------------------------------------------------
    // Bootstrap
    // ----------------------------------------------------------------

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
