/* ================================================================
   YTSimple — fabs.js

   Floating action buttons (notifications, subscriptions, account) and
   their shared panel framework. Each button toggles a panel, closes the
   other panels, and dismisses on outside-click. registerPanel() captures
   that pattern so each feature only declares what's unique to it.
   ================================================================ */

(function () {
  "use strict";

  const YTS = (window.__ytsimple = window.__ytsimple || {});
  const { $, mount } = YTS;

  const panels = [];
  let fabHideTimeout = null;

  function closePanel(entry) {
    entry.open = false;
    entry.panel.classList.remove("ytsimple-show");
    entry.btn.classList.remove("ytsimple-active");
  }

  function anyPanelOpen() {
    return panels.some((p) => p.open);
  }

  YTS.showFabs = function showFabs() {
    clearTimeout(fabHideTimeout);
    panels.forEach((p) => p.btn.classList.add("ytsimple-fab-visible"));
  };

  function hideFabs() {
    // Don't hide if a panel is open
    if (anyPanelOpen()) return;
    panels.forEach((p) => p.btn.classList.remove("ytsimple-fab-visible"));
  }

  YTS.scheduleFabHide = function scheduleFabHide() {
    clearTimeout(fabHideTimeout);
    fabHideTimeout = setTimeout(hideFabs, 2000);
  };

  // config: { btnId, panelId, btnHtml, panelHtml, onOpen? }
  function registerPanel(config) {
    if ($(config.btnId)) return;

    const btn = document.createElement("div");
    btn.id = config.btnId;
    btn.innerHTML = config.btnHtml;
    mount(btn);

    const panel = document.createElement("div");
    panel.id = config.panelId;
    panel.innerHTML = config.panelHtml;
    mount(panel);

    const entry = { btn, panel, open: false };
    panels.push(entry);

    btn.addEventListener("click", () => {
      // Only one panel open at a time
      panels.forEach((p) => { if (p !== entry) closePanel(p); });
      entry.open = !entry.open;
      panel.classList.toggle("ytsimple-show", entry.open);
      btn.classList.toggle("ytsimple-active", entry.open);
      if (entry.open && config.onOpen) config.onOpen();
    });

    document.addEventListener("click", (e) => {
      if (entry.open && !panel.contains(e.target) && !btn.contains(e.target)) {
        closePanel(entry);
        YTS.scheduleFabHide();
      }
    });
  }

  YTS.setupFabs = function setupFabs() {
    // Notifications
    registerPanel({
      btnId: "ytsimple-notif-btn",
      panelId: "ytsimple-notif-panel",
      btnHtml: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
      panelHtml: `
        <div class="ytsimple-subs-header">Notifications</div>
        <div id="ytsimple-notif-list"></div>
      `,
      onOpen: () => YTS.loadNotifications(),
    });

    // Subscriptions
    registerPanel({
      btnId: "ytsimple-subs-btn",
      panelId: "ytsimple-subs-panel",
      btnHtml: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      panelHtml: `
        <div class="ytsimple-subs-header">Subscriptions</div>
        <div id="ytsimple-subs-list"></div>
      `,
      onOpen: () => YTS.loadSubscriptions(),
    });

    // Account
    registerPanel({
      btnId: "ytsimple-account-btn",
      panelId: "ytsimple-account-panel",
      btnHtml: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      panelHtml: `
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
      `,
    });
  };
})();
