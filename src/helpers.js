/* ================================================================
   YTSimple — helpers.js

   Shared utilities used across the other content-script modules.
   Everything is attached to a single namespace object so the modules
   can find each other without leaking globals onto youtube.com.
   ================================================================ */

(function () {
  "use strict";

  const YTS = (window.__ytsimple = window.__ytsimple || {});

  // DOM shortcuts
  YTS.$ = (id) => document.getElementById(id);
  YTS.mount = (el) => (document.body || document.documentElement).appendChild(el);

  // Escape a value for safe interpolation into innerHTML (text or
  // double-quoted attribute context).
  YTS.escapeHtml = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // Page predicates
  YTS.isHomePage = () =>
    window.location.pathname === "/" ||
    window.location.pathname === "/feed/trending";

  YTS.isWatchPage = () => window.location.pathname === "/watch";

  // Extract the first balanced { ... } object that follows `marker` in
  // `text`. Brace-counting (string-aware) rather than a regex, so it is
  // robust to the JSON containing "</script>" or nested braces.
  function extractJsonObject(text, marker) {
    const at = text.indexOf(marker);
    if (at === -1) return null;
    const start = text.indexOf("{", at);
    if (start === -1) return null;

    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') {
        inStr = true;
      } else if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  // Fetch a YouTube page and extract its embedded ytInitialData JSON.
  // Resolves to the parsed object, or null if it can't be found/parsed.
  YTS.fetchInitialData = (url) =>
    fetch(url)
      .then((res) => res.text())
      .then((html) => {
        const json = extractJsonObject(html, "ytInitialData");
        if (!json) return null;
        try {
          return JSON.parse(json);
        } catch (e) {
          return null;
        }
      });

  // Walk the common tabs → sectionList → itemSection structure shared by
  // the notifications and subscriptions feeds, invoking cb for each entry.
  YTS.eachItemSection = (data, cb) => {
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
    if (!tabs) return;
    tabs.forEach((tab) => {
      const sections = tab.tabRenderer?.content?.sectionListRenderer?.contents;
      if (!sections) return;
      sections.forEach((section) => {
        const entries = section.itemSectionRenderer?.contents;
        if (entries) entries.forEach(cb);
      });
    });
  };
})();
