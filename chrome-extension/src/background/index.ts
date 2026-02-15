import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';

exampleThemeStorage.get().then(theme => {
  console.log('theme', theme);
});

console.log('Background loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// Media storage interface
interface MediaChunk {
  url: string;
  sequenceNumber?: number;
  data?: ArrayBuffer;
  timestamp: number;
}

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
  // Chunk-related fields
  isChunked?: boolean;
  chunks?: MediaChunk[];
  baseUrl?: string;
  totalChunks?: number;
  playlistUrl?: string;
}

// Store detected media
const detectedMedia = new Map<string, MediaItem>();

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MEDIA_DETECTED') {
    console.log('[Media Downloader] Media detected:', message);

    const mediaId = `${message.platform}-${message.data.timestamp}-${Math.random().toString(36).slice(2, 11)}`;
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
      isChunked: message.data.isChunked,
      chunks: message.data.chunks || [],
      baseUrl: message.data.baseUrl,
      playlistUrl: message.data.playlistUrl,
    };

    detectedMedia.set(mediaId, mediaItem);

    // Keep only last 50 items to prevent memory issues
    if (detectedMedia.size > 50) {
      const firstKey = detectedMedia.keys().next().value;
      detectedMedia.delete(firstKey);
    }

    // Store in chrome.storage for popup access
    chrome.storage.local.set({
      detectedMedia: Array.from(detectedMedia.values()),
    });

    sendResponse({ success: true, mediaId });
  } else if (message.type === 'CHUNK_DETECTED') {
    handleChunkDetection(message);
    sendResponse({ success: true });
  } else if (message.type === 'GET_DETECTED_MEDIA') {
    sendResponse({ media: Array.from(detectedMedia.values()) });
  } else if (message.type === 'DOWNLOAD_MEDIA') {
    handleMediaDownload(message.mediaId, message.downloadAudio);
    sendResponse({ success: true });
  } else if (message.type === 'MERGE_CHUNKS') {
    handleChunkMerge(message.mediaId);
    sendResponse({ success: true });
  } else if (message.type === 'CLEAR_MEDIA') {
    detectedMedia.clear();
    chrome.storage.local.set({ detectedMedia: [] });
    sendResponse({ success: true });
  }

  return true; // Keep message channel open for async response
});

// Handle chunk detection and grouping
const handleChunkDetection = (message: {
  platform: string;
  data: {
    url: string;
    baseUrl: string;
    sequenceNumber?: number;
    contentType?: string;
  };
  pageUrl: string;
  pageTitle: string;
}) => {
  const { platform, data, pageUrl, pageTitle } = message;
  const { url, contentType, baseUrl, sequenceNumber } = data;

  // Find or create a chunked media item
  let chunkedItem: MediaItem | undefined;

  // Try to find existing chunked item with same baseUrl
  for (const [, item] of detectedMedia.entries()) {
    if (item.isChunked && item.baseUrl === baseUrl && item.pageUrl === pageUrl) {
      chunkedItem = item;
      break;
    }
  }

  // Create new chunked item if not found
  if (!chunkedItem) {
    const mediaId = `${platform}-chunked-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    chunkedItem = {
      id: mediaId,
      platform: platform,
      url: baseUrl,
      contentType: contentType || 'video/mp2t',
      method: 'chunks',
      pageUrl: pageUrl,
      pageTitle: pageTitle,
      timestamp: Date.now(),
      isChunked: true,
      chunks: [],
      baseUrl: baseUrl,
    };
    detectedMedia.set(mediaId, chunkedItem);
  }

  // Add chunk if not already present
  const chunkExists = chunkedItem.chunks?.some(c => c.url === url);
  if (!chunkExists && chunkedItem.chunks) {
    chunkedItem.chunks.push({
      url: url,
      sequenceNumber: sequenceNumber,
      timestamp: Date.now(),
    });

    // Sort chunks by sequence number if available
    if (sequenceNumber !== undefined) {
      chunkedItem.chunks.sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));
    }

    console.log(`[Media Downloader] Chunk added: ${chunkedItem.chunks.length} chunks total`);
  }

  // Update storage
  chrome.storage.local.set({
    detectedMedia: Array.from(detectedMedia.values()),
  });
};

// Handle chunk merging
const handleChunkMerge = async (mediaId: string) => {
  const mediaItem = detectedMedia.get(mediaId);
  if (!mediaItem || !mediaItem.isChunked || !mediaItem.chunks || mediaItem.chunks.length === 0) {
    console.error('[Media Downloader] No chunks found for merging:', mediaId);
    return;
  }

  console.log(`[Media Downloader] Starting merge of ${mediaItem.chunks.length} chunks`);

  try {
    // Download all chunks as ArrayBuffers
    const chunkDataPromises = mediaItem.chunks.map(async (chunk, index) => {
      try {
        const response = await fetch(chunk.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch chunk ${index}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return { index, arrayBuffer, sequenceNumber: chunk.sequenceNumber };
      } catch (error) {
        console.error(`[Media Downloader] Error fetching chunk ${index}:`, error);
        return null;
      }
    });

    const chunkDataResults = await Promise.all(chunkDataPromises);

    // Filter out failed chunks and sort by sequence
    const validChunks = chunkDataResults
      .filter(result => result !== null)
      .sort((a, b) => {
        if (a!.sequenceNumber !== undefined && b!.sequenceNumber !== undefined) {
          return a!.sequenceNumber - b!.sequenceNumber;
        }
        return a!.index - b!.index;
      });

    if (validChunks.length === 0) {
      throw new Error('No valid chunks could be downloaded');
    }

    console.log(`[Media Downloader] Successfully downloaded ${validChunks.length} chunks`);

    // Calculate total size
    const totalSize = validChunks.reduce((sum, chunk) => sum + chunk!.arrayBuffer.byteLength, 0);

    // Merge all chunks into a single ArrayBuffer
    const mergedBuffer = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of validChunks) {
      if (chunk) {
        const chunkArray = new Uint8Array(chunk.arrayBuffer);
        mergedBuffer.set(chunkArray, offset);
        offset += chunkArray.byteLength;
      }
    }

    console.log(`[Media Downloader] Merged ${validChunks.length} chunks into ${totalSize} bytes`);

    // Create blob and data URL
    const mergedBlob = new Blob([mergedBuffer], { type: mediaItem.contentType || 'video/mp2t' });
    const reader = new FileReader();

    reader.onloadend = async function () {
      const dataUrl = reader.result as string;
      const filename = generateFilename(mediaItem, false);

      // Initiate download
      await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: true,
      });

      console.log('[Media Downloader] Merged video download initiated:', filename);
    };

    reader.readAsDataURL(mergedBlob);
  } catch (error) {
    console.error('[Media Downloader] Error merging chunks:', error);
  }
};

// Handle media download
const handleMediaDownload = async (mediaId: string, downloadAudio: boolean = false) => {
  const mediaItem = detectedMedia.get(mediaId);
  if (!mediaItem) {
    console.error('[Media Downloader] Media item not found:', mediaId);
    return;
  }

  try {
    const filename = generateFilename(mediaItem, downloadAudio);
    const downloadUrl = mediaItem.dataUrl || mediaItem.url;

    // For data URLs, we can download directly
    if (downloadUrl) {
      await chrome.downloads.download({
        url: downloadUrl,
        filename: filename,
        saveAs: true,
      });

      console.log('[Media Downloader] Download initiated:', filename);
    }
  } catch (error) {
    console.error('[Media Downloader] Download error:', error);
  }
};

// Generate filename based on media item
const generateFilename = (mediaItem: MediaItem, downloadAudio: boolean): string => {
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
  const cleanTitle =
    mediaItem.pageTitle
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .substring(0, 50) || 'video'; // Fallback for empty titles

  return `${platform}_${cleanTitle}_${timestamp}.${extension}`;
};
