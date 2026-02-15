# Media Downloader Chrome Extension - Implementation Summary

## Overview
This Chrome extension allows users to download videos and audio from Instagram, TikTok, and Facebook by intercepting network requests (fetch, XMLHttpRequest, and blob).

## Key Features

### 1. Main World Script Injection
- **File**: `chrome-extension/public/injected-main-world.js`
- Runs in the MAIN world context (not isolated)
- Intercepts:
  - `fetch()` API calls
  - `XMLHttpRequest` requests
  - `URL.createObjectURL()` for blob handling
- Detects media by:
  - File extensions (.mp4, .webm, .m3u8, .mov, etc.)
  - MIME types (video/*, audio/*, application/x-mpegURL)
- Sends detected media to content script via `window.postMessage()`

### 2. Platform-Specific Content Scripts
- **Instagram**: `pages/content/src/matches/instagram/index.ts`
- **TikTok**: `pages/content/src/matches/tiktok/index.ts`
- **Facebook**: `pages/content/src/matches/facebook/index.ts`

Each content script:
- Runs at `document_start` for early interception
- Injects the main world script
- Listens for postMessage events from injected script
- Forwards detected media to background script

### 3. Background Script
- **File**: `chrome-extension/src/background/index.ts`
- Stores detected media in memory (last 50 items)
- Handles download requests from popup
- Generates appropriate filenames with platform, title, and timestamp
- Supports both video and audio-only downloads

### 4. Popup UI
- **File**: `pages/popup/src/Popup.tsx`
- Displays all detected media from Instagram, TikTok, and Facebook
- Shows:
  - Platform badge (color-coded: purple for Instagram, pink for TikTok, blue for Facebook)
  - Timestamp of detection
  - Page title
  - Content type and file size
- Two download options per media item:
  - "Download Video" button
  - "Download Audio" button
- "Clear All" button to remove all detected media
- Auto-refreshes every 2 seconds to show new detections

## Technical Implementation

### Manifest Configuration
```json
{
  "permissions": ["storage", "scripting", "tabs", "downloads", "activeTab"],
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["https://www.instagram.com/*", "https://instagram.com/*"],
      "js": ["content/instagram.iife.js"],
      "run_at": "document_start"
    },
    // Similar entries for TikTok and Facebook
  ],
  "web_accessible_resources": [
    {
      "resources": ["injected-main-world.js"],
      "matches": ["*://*/*"]
    }
  ]
}
```

### Communication Flow
1. Main world script detects media request → sends message via postMessage
2. Content script receives message → forwards to background via chrome.runtime.sendMessage
3. Background stores media data → saves to chrome.storage.local
4. Popup queries background → displays media list
5. User clicks download → popup sends download request to background
6. Background initiates download via chrome.downloads.download

### Build System
- Uses Vite for building
- Content scripts built sequentially to avoid race conditions
- Builds to `dist/` directory ready for Chrome loading

## File Structure
```
chrome-extension/
├── manifest.ts                    # Manifest configuration
├── public/
│   └── injected-main-world.js    # Main world interceptor script
└── src/
    └── background/
        └── index.ts              # Background service worker

pages/
├── content/
│   └── src/
│       └── matches/
│           ├── instagram/index.ts
│           ├── tiktok/index.ts
│           └── facebook/index.ts
└── popup/
    └── src/
        └── Popup.tsx             # Popup UI
```

## Usage
1. Build the extension: `pnpm build`
2. Load `dist/` folder in Chrome as unpacked extension
3. Visit Instagram, TikTok, or Facebook
4. Videos will be automatically detected
5. Click extension icon to see detected media
6. Click download buttons to save video or audio

## Security Notes
- The main world script cannot use `chrome.*` APIs (required by MV3)
- Communication happens via window.postMessage with source verification
- Downloads require user interaction (clicking download button)
- All permissions are properly declared in manifest

