/* ================================================================
   YTSimple — feeds.js

   Loads and renders the notifications and subscriptions feeds shown in
   the floating-button panels. Both parse the embedded ytInitialData of
   the corresponding YouTube feed page (see helpers.fetchInitialData).
   ================================================================ */

(function () {
  "use strict";

  const YTS = (window.__ytsimple = window.__ytsimple || {});
  const { $, escapeHtml, fetchInitialData, eachItemSection } = YTS;

  // ---- Notifications ----------------------------------------------

  let notifCache = null;

  YTS.loadNotifications = function loadNotifications() {
    const list = $("ytsimple-notif-list");
    if (!list) return;

    if (notifCache) {
      renderNotifications(notifCache);
      return;
    }

    list.innerHTML = '<div class="ytsimple-subs-empty">Loading...</div>';

    fetchInitialData("/feed/notifications")
      .then((data) => {
        const notifs = [];
        if (data) {
          eachItemSection(data, (entry) => {
            const notif = entry.notificationRenderer;
            if (!notif) return;
            const text = notif.shortMessage?.simpleText || "";
            const time = notif.sentTimeText?.simpleText || "";
            const img = notif.thumbnail?.thumbnails?.[0]?.url || "";
            const url = notif.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || "";
            if (text) notifs.push({ text, time, img, url });
          });
        }
        notifCache = notifs;
        renderNotifications(notifs);
      })
      .catch(() => {
        list.innerHTML = '<div class="ytsimple-subs-empty">Failed to load</div>';
      });
  };

  function renderNotifications(notifs) {
    const list = $("ytsimple-notif-list");
    if (!list) return;

    if (notifs.length === 0) {
      list.innerHTML = '<div class="ytsimple-subs-empty">No notifications</div>';
      return;
    }

    list.innerHTML = notifs.map((n) => {
      const imgHtml = n.img
        ? '<img class="ytsimple-notif-thumb" src="' + escapeHtml(n.img) + '" />'
        : '';
      const tag = n.url ? 'a' : 'div';
      const href = n.url ? ' href="' + escapeHtml(n.url) + '"' : '';
      return '<' + tag + ' class="ytsimple-notif-item"' + href + '>' +
        imgHtml +
        '<div class="ytsimple-notif-text">' +
          '<span class="ytsimple-notif-msg">' + escapeHtml(n.text) + '</span>' +
          '<span class="ytsimple-notif-time">' + escapeHtml(n.time) + '</span>' +
        '</div>' +
      '</' + tag + '>';
    }).join("");
  }

  // ---- Subscriptions ----------------------------------------------

  let subsCache = null;

  YTS.loadSubscriptions = function loadSubscriptions() {
    const list = $("ytsimple-subs-list");
    if (!list) return;

    if (subsCache) {
      renderSubs(subsCache);
      return;
    }

    list.innerHTML = '<div class="ytsimple-subs-empty">Loading...</div>';

    fetchInitialData("/feed/channels")
      .then((data) => {
        const subs = [];
        if (data) {
          eachItemSection(data, (item) => {
            const grid =
              item.shelfRenderer?.content?.expandedShelfContentsRenderer?.items ||
              item.gridRenderer?.items;
            if (!grid) return;
            grid.forEach((ch) => {
              const channel = ch.channelRenderer;
              if (!channel) return;
              const name = channel.title?.simpleText || "";
              const url = channel.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || "";
              const img = channel.thumbnail?.thumbnails?.[0]?.url || "";
              if (name && url) subs.push({ name, url, img });
            });
          });
        }
        subsCache = subs;
        renderSubs(subs);
      })
      .catch(() => {
        list.innerHTML = '<div class="ytsimple-subs-empty">Failed to load</div>';
      });
  };

  function renderSubs(subs) {
    const list = $("ytsimple-subs-list");
    if (!list) return;

    if (subs.length === 0) {
      list.innerHTML = '<div class="ytsimple-subs-empty">No subscriptions found</div>';
      return;
    }

    list.innerHTML = subs.map((sub) => {
      const imgHtml = sub.img
        ? '<img class="ytsimple-sub-avatar" src="' + escapeHtml(sub.img) + '" />'
        : '<div class="ytsimple-sub-avatar-placeholder"></div>';
      const subUrl = sub.url.replace(/\/+$/, "") + "/videos";
      return '<a class="ytsimple-sub-item" href="' + escapeHtml(subUrl) + '">' +
        imgHtml + '<span>' + escapeHtml(sub.name) + '</span></a>';
    }).join("");
  }
})();
