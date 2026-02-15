import '@src/Popup.css';
import { t } from '@extension/i18n';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, ToggleButton } from '@extension/ui';
import { useEffect, useState } from 'react';

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
  isChunked?: boolean;
  chunks?: MediaChunk[];
  baseUrl?: string;
  totalChunks?: number;
  playlistUrl?: string;
}

const Popup = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [detectedMedia, setDetectedMedia] = useState<MediaItem[]>([]);

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
        downloadAudio,
      });
    } catch (err) {
      console.error('Error downloading media:', err);
    }
  };

  const handleMergeChunks = async (mediaId: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'MERGE_CHUNKS',
        mediaId,
      });
    } catch (err) {
      console.error('Error merging chunks:', err);
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
      <header
        className={cn('border-b p-4', isLight ? 'border-gray-200 text-gray-900' : 'border-gray-700 text-gray-100')}>
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold">Media Downloader</h1>
          <ToggleButton>{t('toggleTheme')}</ToggleButton>
        </div>
        <p className="text-sm opacity-75">Detected media from Instagram, TikTok, and Facebook</p>
      </header>

      <div className="overflow-y-auto p-4" style={{ maxHeight: '500px' }}>
        {detectedMedia.length === 0 ? (
          <div className={cn('py-8 text-center', isLight ? 'text-gray-600' : 'text-gray-400')}>
            <p className="mb-2">No media detected yet</p>
            <p className="text-sm">Visit Instagram, TikTok, or Facebook to start detecting videos</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold">
                {detectedMedia.length} media {detectedMedia.length === 1 ? 'item' : 'items'} detected
              </p>
              <button
                onClick={handleClearAll}
                className={cn(
                  'rounded px-3 py-1 text-xs hover:scale-105',
                  isLight ? 'bg-red-200 text-red-800' : 'bg-red-900 text-red-200',
                )}>
                Clear All
              </button>
            </div>

            <div className="space-y-3">
              {detectedMedia.map(media => (
                <div
                  key={media.id}
                  className={cn(
                    'rounded-lg border p-3',
                    isLight ? 'border-gray-200 bg-white' : 'border-gray-600 bg-gray-700',
                  )}>
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 text-xs font-semibold',
                            media.platform === 'instagram'
                              ? 'bg-purple-200 text-purple-800'
                              : media.platform === 'tiktok'
                                ? 'bg-pink-200 text-pink-800'
                                : 'bg-blue-200 text-blue-800',
                          )}>
                          {media.platform}
                        </span>
                        <span className="text-xs opacity-75">{formatTimestamp(media.timestamp)}</span>
                      </div>
                      <p className="truncate text-sm font-medium" title={media.pageTitle}>
                        {media.pageTitle}
                      </p>
                      <p className="mt-1 text-xs opacity-75">
                        {media.contentType || 'Unknown type'} • {formatSize(media.size)}
                        {media.isChunked && media.chunks && (
                          <span className="ml-2 rounded bg-yellow-200 px-1.5 py-0.5 text-xs font-semibold text-yellow-800">
                            {media.chunks.length} chunks
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    {media.isChunked && media.chunks && media.chunks.length > 0 ? (
                      <button
                        onClick={() => handleMergeChunks(media.id)}
                        className={cn(
                          'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-transform hover:scale-105',
                          isLight
                            ? 'bg-purple-500 text-white hover:bg-purple-600'
                            : 'bg-purple-600 text-white hover:bg-purple-700',
                        )}>
                        Merge & Download ({media.chunks.length} chunks)
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleDownload(media.id, false)}
                          className={cn(
                            'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-transform hover:scale-105',
                            isLight
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-blue-600 text-white hover:bg-blue-700',
                          )}>
                          Download Video
                        </button>
                        <button
                          onClick={() => handleDownload(media.id, true)}
                          className={cn(
                            'flex-1 rounded px-3 py-1.5 text-sm font-medium transition-transform hover:scale-105',
                            isLight
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-green-600 text-white hover:bg-green-700',
                          )}>
                          Download Audio
                        </button>
                      </>
                    )}
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
