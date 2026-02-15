// This script runs in MAIN world to intercept fetch, XMLHttpRequest, and blob
// It cannot use chrome.* APIs, so it uses window.postMessage to communicate

(function() {
  'use strict';

  const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.m3u8', '.ts', '.m4s', '.mov', '.avi', '.mkv'];
  const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.ogg'];
  const VIDEO_MIME_TYPES = ['video/', 'application/x-mpegURL', 'application/vnd.apple.mpegurl'];
  const AUDIO_MIME_TYPES = ['audio/'];

  function isMediaUrl(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => urlLower.includes(ext)) || 
           AUDIO_EXTENSIONS.some(ext => urlLower.includes(ext));
  }

  function isMediaType(type) {
    if (!type) return false;
    const typeLower = type.toLowerCase();
    return VIDEO_MIME_TYPES.some(mime => typeLower.includes(mime)) ||
           AUDIO_MIME_TYPES.some(mime => typeLower.includes(mime));
  }

  function sendToContentScript(data) {
    window.postMessage({
      type: 'MEDIA_INTERCEPTED',
      source: 'media-downloader-injected',
      data: data
    }, '*');
  }

  // Intercept fetch API
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0] instanceof Request ? args[0].url : args[0];
    
    return originalFetch.apply(this, args).then(response => {
      const contentType = response.headers.get('content-type');
      
      if (isMediaUrl(url) || isMediaType(contentType)) {
        console.log('[Media Downloader] Detected media via fetch:', url);
        sendToContentScript({
          method: 'fetch',
          url: url,
          contentType: contentType,
          timestamp: Date.now()
        });
      }
      
      return response;
    });
  };

  // Intercept XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._mediaDownloaderUrl = url;
    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('readystatechange', function() {
      if (this.readyState === 4 && this.status === 200) {
        const contentType = this.getResponseHeader('content-type');
        const url = this._mediaDownloaderUrl;
        
        if (isMediaUrl(url) || isMediaType(contentType)) {
          console.log('[Media Downloader] Detected media via XHR:', url);
          sendToContentScript({
            method: 'xhr',
            url: url,
            contentType: contentType,
            timestamp: Date.now()
          });
        }
      }
    });
    
    return originalSend.apply(this, args);
  };

  // Intercept Blob and URL.createObjectURL
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = function(blob) {
    const url = originalCreateObjectURL.apply(this, arguments);
    
    if (blob instanceof Blob && isMediaType(blob.type)) {
      console.log('[Media Downloader] Detected media blob:', blob.type, blob.size);
      
      // Create a more persistent reference
      const reader = new FileReader();
      reader.onloadend = function() {
        sendToContentScript({
          method: 'blob',
          blobUrl: url,
          contentType: blob.type,
          size: blob.size,
          timestamp: Date.now(),
          dataUrl: reader.result
        });
      };
      reader.readAsDataURL(blob);
    }
    
    return url;
  };

  console.log('[Media Downloader] Injection script loaded in MAIN world');
})();
