import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// Media storage interface
interface MediaItem {
  id: string;
  platform: string;
  url: string;
  contentType: string;
  method: string;
  pageUrl: string;
  pageTitle: string;
  timestamp: number;
  size?: number;
  blobUrl?: string;
  dataUrl?: string;
}

// Store detected media
const detectedMedia = new Map<string, MediaItem>();

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MEDIA_DETECTED') {
    console.log('[Media Downloader] Media detected:', message);
    
    const mediaId = `${message.platform}-${message.data.timestamp}-${Math.random().toString(36).substr(2, 9)}`;
    const mediaItem: MediaItem = {
      id: mediaId,
      platform: message.platform,
      url: message.data.url || message.data.blobUrl,
      contentType: message.data.contentType,
      method: message.data.method,
      pageUrl: message.pageUrl,
      pageTitle: message.pageTitle,
      timestamp: message.data.timestamp,
      size: message.data.size,
      blobUrl: message.data.blobUrl,
      dataUrl: message.data.dataUrl,
    };
    
    detectedMedia.set(mediaId, mediaItem);
    
    // Keep only last 50 items to prevent memory issues
    if (detectedMedia.size > 50) {
      const firstKey = detectedMedia.keys().next().value;
      detectedMedia.delete(firstKey);
    }
    
    // Store in chrome.storage for popup access
    chrome.storage.local.set({
      detectedMedia: Array.from(detectedMedia.values())
    });
    
    sendResponse({ success: true, mediaId });
  } else if (message.type === 'GET_DETECTED_MEDIA') {
    sendResponse({ media: Array.from(detectedMedia.values()) });
  } else if (message.type === 'DOWNLOAD_MEDIA') {
    handleMediaDownload(message.mediaId, message.downloadAudio);
    sendResponse({ success: true });
  } else if (message.type === 'CLEAR_MEDIA') {
    detectedMedia.clear();
    chrome.storage.local.set({ detectedMedia: [] });
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});

// Handle media download
async function handleMediaDownload(mediaId: string, downloadAudio: boolean = false) {
  const mediaItem = detectedMedia.get(mediaId);
  if (!mediaItem) {
    console.error('[Media Downloader] Media item not found:', mediaId);
    return;
  }
  
  try {
    let filename = generateFilename(mediaItem, downloadAudio);
    let downloadUrl = mediaItem.dataUrl || mediaItem.url;
    
    // For data URLs, we can download directly
    if (downloadUrl) {
      await chrome.downloads.download({
        url: downloadUrl,
        filename: filename,
        saveAs: true
      });
      
      console.log('[Media Downloader] Download initiated:', filename);
    }
  } catch (error) {
    console.error('[Media Downloader] Download error:', error);
  }
}

// Generate filename based on media item
function generateFilename(mediaItem: MediaItem, downloadAudio: boolean): string {
  const timestamp = new Date(mediaItem.timestamp).toISOString().replace(/[:.]/g, '-');
  const platform = mediaItem.platform;
  
  // Extract extension from content type or URL
  let extension = 'mp4';
  if (downloadAudio) {
    extension = 'm4a';
  } else if (mediaItem.contentType) {
    const match = mediaItem.contentType.match(/(video|audio)\/(\w+)/);
    if (match) {
      extension = match[2] === 'quicktime' ? 'mov' : match[2];
    }
  } else if (mediaItem.url) {
    const urlMatch = mediaItem.url.match(/\.(mp4|webm|mov|m3u8|m4a|mp3)/i);
    if (urlMatch) {
      extension = urlMatch[1].toLowerCase();
    }
  }
  
  // Clean page title for filename
  const cleanTitle = mediaItem.pageTitle
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
  
  return `${platform}_${cleanTitle}_${timestamp}.${extension}`;
}

