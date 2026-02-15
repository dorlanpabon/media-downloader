// Content script for Facebook
console.log('[Media Downloader] Facebook content script loaded');

// Inject the MAIN world script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected-main-world.js');
script.onload = function () {
  console.log('[Media Downloader] MAIN world script injected');
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for messages from the injected script
window.addEventListener('message', function (event) {
  // Only accept messages from same window
  if (event.source !== window) return;

  // Handle chunk interception
  if (event.data.type === 'CHUNK_INTERCEPTED' && event.data.source === 'media-downloader-injected') {
    console.log('[Media Downloader] Received chunk data from Facebook:', event.data.data);

    chrome.runtime
      .sendMessage({
        type: 'CHUNK_DETECTED',
        platform: 'facebook',
        data: event.data.data,
        pageUrl: window.location.href,
        pageTitle: document.title,
      })
      .catch(err => {
        console.error('[Media Downloader] Error sending chunk to background:', err);
      });
    return;
  }

  // Handle regular media interception
  if (event.data.type !== 'MEDIA_INTERCEPTED' || event.data.source !== 'media-downloader-injected') {
    return;
  }

  console.log('[Media Downloader] Received media data from Facebook:', event.data.data);

  // Send to background script
  chrome.runtime
    .sendMessage({
      type: 'MEDIA_DETECTED',
      platform: 'facebook',
      data: event.data.data,
      pageUrl: window.location.href,
      pageTitle: document.title,
    })
    .catch(err => {
      console.error('[Media Downloader] Error sending to background:', err);
    });
});
