import '@src/Popup.css';
import { useEffect, useState } from 'react';
import { t } from '@extension/i18n';
import { PROJECT_URL_OBJECT, useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';

const notificationOptions = {
  type: 'basic',
  iconUrl: chrome.runtime.getURL('icon-34.png'),
  title: 'Injecting content script error',
  message: 'You cannot inject script here!',
} as const;

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
}

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const logo = isLight ? 'popup/logo_vertical.svg' : 'popup/logo_vertical_dark.svg';
  const [detectedMedia, setDetectedMedia] = useState<MediaItem[]>([]);

  const goGithubSite = () => chrome.tabs.create(PROJECT_URL_OBJECT);

  const injectContentScript = async () => {
    const [tab] = await chrome.tabs.query({ currentWindow: true, active: true });

    if (tab.url!.startsWith('about:') || tab.url!.startsWith('chrome:')) {
      chrome.notifications.create('inject-error', notificationOptions);
    }

    await chrome.scripting
      .executeScript({
        target: { tabId: tab.id! },
        files: ['/content-runtime/example.iife.js', '/content-runtime/all.iife.js'],
      })
      .catch(err => {
        // Handling errors related to other paths
        if (err.message.includes('Cannot access a chrome:// URL')) {
          chrome.notifications.create('inject-error', notificationOptions);
        }
      });
  };

  // Load detected media on mount
  useEffect(() => {
    const loadMedia = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_DETECTED_MEDIA' });
        if (response.media) {
          setDetectedMedia(response.media);
        }
      } catch (err) {
        console.error('Error loading media:', err);
      }
    };

    loadMedia();
    
    // Refresh every 2 seconds
    const interval = setInterval(loadMedia, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = async (mediaId: string, downloadAudio: boolean = false) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'DOWNLOAD_MEDIA',
        mediaId,
        downloadAudio
      });
    } catch (err) {
      console.error('Error downloading media:', err);
    }
  };

  const handleClearAll = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_MEDIA' });
      setDetectedMedia([]);
    } catch (err) {
      console.error('Error clearing media:', err);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className={cn('App', isLight ? 'bg-slate-50' : 'bg-gray-800')} style={{ width: '500px', maxHeight: '600px' }}>
      <header className={cn('p-4 border-b', isLight ? 'text-gray-900 border-gray-200' : 'text-gray-100 border-gray-700')}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">Media Downloader</h1>
          <ToggleButton>{t('toggleTheme')}</ToggleButton>
        </div>
        <p className="text-sm opacity-75">
          Detected media from Instagram, TikTok, and Facebook
        </p>
      </header>

      <div className="p-4 overflow-y-auto" style={{ maxHeight: '500px' }}>
        {detectedMedia.length === 0 ? (
          <div className={cn('text-center py-8', isLight ? 'text-gray-600' : 'text-gray-400')}>
            <p className="mb-2">No media detected yet</p>
            <p className="text-sm">
              Visit Instagram, TikTok, or Facebook to start detecting videos
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm font-semibold">
                {detectedMedia.length} media item{detectedMedia.length !== 1 ? 's' : ''} detected
              </p>
              <button
                onClick={handleClearAll}
                className={cn(
                  'px-3 py-1 text-xs rounded hover:scale-105',
                  isLight ? 'bg-red-200 text-red-800' : 'bg-red-900 text-red-200'
                )}>
                Clear All
              </button>
            </div>
            
            <div className="space-y-3">
              {detectedMedia.map(media => (
                <div
                  key={media.id}
                  className={cn(
                    'p-3 rounded-lg border',
                    isLight ? 'bg-white border-gray-200' : 'bg-gray-700 border-gray-600'
                  )}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'px-2 py-0.5 text-xs rounded font-semibold',
                          media.platform === 'instagram' ? 'bg-purple-200 text-purple-800' :
                          media.platform === 'tiktok' ? 'bg-pink-200 text-pink-800' :
                          'bg-blue-200 text-blue-800'
                        )}>
                          {media.platform}
                        </span>
                        <span className="text-xs opacity-75">
                          {formatTimestamp(media.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate" title={media.pageTitle}>
                        {media.pageTitle}
                      </p>
                      <p className="text-xs opacity-75 mt-1">
                        {media.contentType || 'Unknown type'} • {formatSize(media.size)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleDownload(media.id, false)}
                      className={cn(
                        'flex-1 px-3 py-1.5 text-sm rounded font-medium hover:scale-105 transition-transform',
                        isLight ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'
                      )}>
                      Download Video
                    </button>
                    <button
                      onClick={() => handleDownload(media.id, true)}
                      className={cn(
                        'flex-1 px-3 py-1.5 text-sm rounded font-medium hover:scale-105 transition-transform',
                        isLight ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-green-600 text-white hover:bg-green-700'
                      )}>
                      Download Audio
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Popup, <LoadingSpinner />), ErrorDisplay);
