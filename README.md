# YTSimple

A simplified YouTube experience — just the video, the title, and a search bar.

## What is this?

YTSimple is a Chrome extension that strips YouTube down to what actually matters. No ads, no recommendations, no comments, no sidebar, no distractions. You open YouTube, you search for something, you watch it. That's it.

## Features

* **Custom homepage** with a clean search bar and autocomplete suggestions
* **Shorts redirect** so shorts just play as normal videos
* **Channel page redirect** straight to the Videos tab
* **Auto hiding header** that shows up when your mouse reaches the top
* **Floating buttons** for quick access to subscriptions, notifications, and your account
* **Ad removal** including video ads, display ads, and banners
* **Clutter removal** for recommendations, comments, descriptions, end screens, and everything else YouTube throws at you

## Install

1. Clone or download this repo
2. Go to `chrome://extensions/`
3. Turn on Developer mode (top right)
4. Click "Load unpacked" and select the folder
5. Done

## Usage

Click the extension icon in your toolbar to toggle it on or off. The state saves between sessions. Move your mouse to the top of the page to reveal the search bar, or to the bottom right corner to see the floating buttons.

## Privacy

YTSimple collects zero data. The only thing stored is a single on/off toggle in your browser's local storage. The only network request it makes is to Google's autocomplete API when you type in the search bar. Nothing else leaves your machine. Full details in [privacy.md](privacy.md).

## License

MIT
