// This script runs in MAIN world to intercept fetch, XMLHttpRequest, and blob
// It cannot use chrome.* APIs, so it uses window.postMessage to communicate
/* eslint-disable */

(function () {
  'use strict';

  const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.m3u8', '.ts', '.m4s', '.mov', '.avi', '.mkv'];
  const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.ogg'];
  const VIDEO_MIME_TYPES = ['video/', 'application/x-mpegURL', 'application/vnd.apple.mpegurl'];
  const AUDIO_MIME_TYPES = ['audio/'];
  const CHUNK_EXTENSIONS = ['.ts', '.m4s'];

  // Store to track playlists and chunk patterns
  const playlistTracking = new Map();

  function isMediaUrl(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    // Check if URL ends with a video or audio extension
    return (
      VIDEO_EXTENSIONS.some(ext => {
        const extIndex = urlLower.lastIndexOf(ext);
        // Ensure it's at the end or followed by query parameters
        return (
          extIndex !== -1 && (extIndex === urlLower.length - ext.length || urlLower[extIndex + ext.length] === '?')
        );
      }) ||
      AUDIO_EXTENSIONS.some(ext => {
        const extIndex = urlLower.lastIndexOf(ext);
        return (
          extIndex !== -1 && (extIndex === urlLower.length - ext.length || urlLower[extIndex + ext.length] === '?')
        );
      })
    );
  }

  function isMediaType(type) {
    if (!type) return false;
    const typeLower = type.toLowerCase();
    return (
      VIDEO_MIME_TYPES.some(mime => typeLower.includes(mime)) || AUDIO_MIME_TYPES.some(mime => typeLower.includes(mime))
    );
  }

  function isChunkUrl(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return CHUNK_EXTENSIONS.some(ext => {
      const extIndex = urlLower.lastIndexOf(ext);
      return extIndex !== -1 && (extIndex === urlLower.length - ext.length || urlLower[extIndex + ext.length] === '?');
    });
  }

  function extractSequenceNumber(url) {
    // Try to extract sequence number from URL patterns like:
    // segment_123.ts, chunk123.m4s, 00123.ts, etc.
    const patterns = [/segment[_-]?(\d+)/i, /chunk[_-]?(\d+)/i, /(\d+)\.(ts|m4s)/i, /seg(\d+)/i];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    return undefined;
  }

  function getBaseUrl(url) {
    // Extract base URL without the chunk-specific part
    // Remove the segment filename but keep the path
    const lastSlash = url.lastIndexOf('/');
    if (lastSlash > 0) {
      return url.substring(0, lastSlash + 1);
    }
    return url;
  }

  function sendToContentScript(data) {
    window.postMessage(
      {
        type: 'MEDIA_INTERCEPTED',
        source: 'media-downloader-injected',
        data: data,
      },
      '*',
    );
  }

  // Intercept fetch API
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const url = args[0] instanceof Request ? args[0].url : args[0];

    return originalFetch.apply(this, args).then(response => {
      const contentType = response.headers.get('content-type');

      // Check if it's a playlist file (.m3u8)
      if (url && url.toLowerCase().includes('.m3u8')) {
        console.log('[Media Downloader] Detected playlist:', url);
        playlistTracking.set(url, { timestamp: Date.now() });
        sendToContentScript({
          method: 'fetch',
          url: url,
          contentType: contentType || 'application/x-mpegURL',
          timestamp: Date.now(),
          isPlaylist: true,
        });
      }
      // Check if it's a chunk
      else if (isChunkUrl(url)) {
        const baseUrl = getBaseUrl(url);
        const sequenceNumber = extractSequenceNumber(url);

        console.log('[Media Downloader] Detected chunk:', url, 'seq:', sequenceNumber);

        window.postMessage(
          {
            type: 'CHUNK_INTERCEPTED',
            source: 'media-downloader-injected',
            data: {
              url: url,
              baseUrl: baseUrl,
              sequenceNumber: sequenceNumber,
              contentType: contentType || 'video/mp2t',
              timestamp: Date.now(),
            },
          },
          '*',
        );
      }
      // Regular media detection
      else if (isMediaUrl(url) || isMediaType(contentType)) {
        console.log('[Media Downloader] Detected media via fetch:', url);
        sendToContentScript({
          method: 'fetch',
          url: url,
          contentType: contentType,
          timestamp: Date.now(),
        });
      }

      return response;
    });
  };

  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._mediaDownloaderUrl = url;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('readystatechange', function () {
      if (this.readyState === 4 && this.status === 200) {
        const contentType = this.getResponseHeader('content-type');
        const url = this._mediaDownloaderUrl;

        // Check if it's a playlist
        if (url && url.toLowerCase().includes('.m3u8')) {
          console.log('[Media Downloader] Detected playlist via XHR:', url);
          playlistTracking.set(url, { timestamp: Date.now() });
          sendToContentScript({
            method: 'xhr',
            url: url,
            contentType: contentType || 'application/x-mpegURL',
            timestamp: Date.now(),
            isPlaylist: true,
          });
        }
        // Check if it's a chunk
        else if (isChunkUrl(url)) {
          const baseUrl = getBaseUrl(url);
          const sequenceNumber = extractSequenceNumber(url);

          console.log('[Media Downloader] Detected chunk via XHR:', url, 'seq:', sequenceNumber);

          window.postMessage(
            {
              type: 'CHUNK_INTERCEPTED',
              source: 'media-downloader-injected',
              data: {
                url: url,
                baseUrl: baseUrl,
                sequenceNumber: sequenceNumber,
                contentType: contentType || 'video/mp2t',
                timestamp: Date.now(),
              },
            },
            '*',
          );
        }
        // Regular media detection
        else if (isMediaUrl(url) || isMediaType(contentType)) {
          console.log('[Media Downloader] Detected media via XHR:', url);
          sendToContentScript({
            method: 'xhr',
            url: url,
            contentType: contentType,
            timestamp: Date.now(),
          });
        }
      }
    });

    return originalSend.apply(this, args);
  };

  // Intercept Blob and URL.createObjectURL
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function (blob) {
    const url = originalCreateObjectURL.apply(this, arguments);

    if (blob instanceof Blob && isMediaType(blob.type)) {
      console.log('[Media Downloader] Detected media blob:', blob.type, blob.size);

      // Create a more persistent reference
      const reader = new FileReader();
      reader.onloadend = function () {
        sendToContentScript({
          method: 'blob',
          blobUrl: url,
          contentType: blob.type,
          size: blob.size,
          timestamp: Date.now(),
          dataUrl: reader.result,
        });
      };
      reader.readAsDataURL(blob);
    }

    return url;
  };

  console.log('[Media Downloader] Injection script loaded in MAIN world');
})();
