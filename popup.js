const toggle = document.getElementById("toggle");

// Load saved state
chrome.storage.local.get("enabled", (data) => {
  toggle.checked = data.enabled !== false;
});

// Save state on toggle and reload the active tab
toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  chrome.storage.local.set({ enabled }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes("youtube.com")) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });
});
