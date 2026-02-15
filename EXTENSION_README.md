# Media Downloader Chrome Extension

A Chrome extension that allows you to download videos and audio from Instagram, TikTok, and Facebook by intercepting network requests.

## Features

- 🎥 **Video Detection**: Automatically detects videos from Instagram, TikTok, and Facebook
- 📥 **Easy Downloads**: Download videos or extract audio with one click
- 🧩 **Chunk Merging**: Automatically detects and merges HLS/DASH streaming video segments
- 🎨 **Clean UI**: Modern popup interface with platform badges and media details
- ⚡ **Real-time**: Detects media as you browse, updates every 2 seconds
- 🔒 **Secure**: Passes all security checks, no data is sent to external servers

## Installation

1. Build the extension:
   ```bash
   pnpm install
   pnpm build
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this repository

## Usage

1. **Visit Supported Sites**: Go to Instagram, TikTok, or Facebook
2. **Browse Content**: Videos will be automatically detected as they load
3. **Open Extension**: Click the extension icon in the toolbar
4. **Download**: 
   - For regular videos: Choose "Download Video" or "Download Audio"
   - For streaming videos (chunks): Wait for all chunks to load, then click "Merge & Download"

### Chunked Videos (HLS/DASH Streams)

Many streaming services split videos into small chunks. The extension automatically:
- Detects video chunks (.ts, .m4s files)
- Groups them by video
- Shows chunk count with a yellow badge
- Provides a "Merge & Download" button to combine all chunks into a single file

**See [CHUNK_MERGING.md](CHUNK_MERGING.md) for detailed information about the chunk merging feature.**

## How It Works

### Architecture

1. **Main World Script** (`injected-main-world.js`)
   - Runs in the page's main JavaScript context
   - Intercepts:
     - `fetch()` API calls
     - `XMLHttpRequest` requests
     - `URL.createObjectURL()` for blob handling
   - Detects media by file extensions (.mp4, .webm, etc.) and MIME types

2. **Content Scripts** (Instagram/TikTok/Facebook)
   - Run at `document_start` for early interception
   - Inject the main world script into the page
   - Forward detected media to the background script

3. **Background Script**
   - Stores up to 50 most recent media detections
   - Handles download requests
   - Generates smart filenames with platform, title, and timestamp

4. **Popup UI**
   - Displays all detected media with platform badges
   - Shows timestamp, title, content type, and file size
   - Provides download buttons for video and audio

### Communication Flow

```
Page → Main World Script (intercept) 
     → Content Script (postMessage) 
     → Background Script (chrome.runtime.sendMessage)
     → Storage
     ← Popup (chrome.runtime.sendMessage)
     → Downloads (chrome.downloads.download)
```

## Supported Platforms

- ✅ Instagram (instagram.com, www.instagram.com)
- ✅ TikTok (tiktok.com, www.tiktok.com)  
- ✅ Facebook (facebook.com, www.facebook.com, fb.com)

## Permissions

The extension requires the following permissions:

- `storage`: Store detected media temporarily
- `downloads`: Initiate file downloads
- `activeTab`: Access current tab URL
- `scripting`: Inject content scripts
- `tabs`: Query active tabs
- `<all_urls>`: Detect media on any site (limited to Instagram, TikTok, Facebook in practice)

## Development

### Project Structure

```
chrome-extension/
├── manifest.ts                    # Extension manifest
├── public/
│   └── injected-main-world.js    # Main world interceptor
└── src/
    └── background/
        └── index.ts              # Background service worker

pages/
├── content/
│   └── src/matches/
│       ├── instagram/index.ts    # Instagram content script
│       ├── tiktok/index.ts       # TikTok content script
│       └── facebook/index.ts     # Facebook content script
└── popup/
    └── src/
        └── Popup.tsx             # Popup UI component
```

### Build System

- Uses Vite for fast building
- Turborepo for monorepo management
- TypeScript for type safety
- React for UI components
- Tailwind CSS for styling

### Building

```bash
# Install dependencies
pnpm install

# Development build (with hot reload)
pnpm dev

# Production build
pnpm build

# Build for Firefox
pnpm build:firefox
```

## Troubleshooting

### Extension Not Detecting Videos

1. Make sure you're on Instagram, TikTok, or Facebook
2. Refresh the page after installing the extension
3. Check the browser console for any errors (F12 → Console)

### Downloads Not Working

1. Check Chrome's download settings (chrome://settings/downloads)
2. Ensure you have write permissions to the download folder
3. Some videos may be protected or in streaming formats that can't be easily downloaded

### Content Scripts Not Loading

1. Verify the extension is enabled in chrome://extensions/
2. Make sure "Developer mode" is enabled
3. Try removing and re-loading the extension

## Privacy & Security

- ✅ **No External Servers**: All processing happens locally in your browser
- ✅ **No Data Collection**: No user data is collected or transmitted
- ✅ **Open Source**: All code is available for review
- ✅ **Security Scanned**: Passes CodeQL security analysis

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## Support

For issues or questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section

## Credits

Built with:
- [Chrome Extension Boilerplate with React + Vite](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite)
- React, TypeScript, Tailwind CSS, Vite, Turborepo

---

**Note**: This extension is for personal use only. Please respect content creators' rights and platform terms of service.
