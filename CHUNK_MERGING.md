# Video Chunk Merging Feature

## Overview

The media downloader extension now supports automatic detection and merging of chunked video streams. This is essential for downloading videos from streaming services that use HLS (HTTP Live Streaming) or DASH (Dynamic Adaptive Streaming over HTTP) protocols, which split videos into multiple small segments.

## Supported Formats

- **HLS Streams**: `.m3u8` playlists with `.ts` segments
- **DASH Streams**: `.m4s` segments
- **Sequence-numbered chunks**: Any format with sequence numbers in URLs

## How It Works

### 1. Chunk Detection

The extension automatically detects video chunks by:

- Monitoring requests for `.ts` and `.m4s` files
- Identifying `.m3u8` playlist files
- Extracting sequence numbers from URLs using patterns:
  - `segment_123.ts`
  - `chunk123.m4s`
  - `seg00123.ts`
  - `00123.ts`

### 2. Chunk Grouping

Chunks are automatically grouped by:

- **Base URL**: Chunks from the same video share the same base path
- **Page Context**: Only chunks from the same page are grouped together
- **Platform**: Separated by social media platform (Instagram/TikTok/Facebook)

### 3. User Interface

In the popup, chunked videos are displayed with:

- **Yellow Badge**: Shows number of chunks detected (e.g., "5 chunks")
- **Special Button**: "Merge & Download (X chunks)" instead of regular download buttons
- **Real-time Updates**: Chunk count updates as more segments are detected

### 4. Merging Process

When you click "Merge & Download":

1. **Download Phase**: All chunks are fetched as ArrayBuffers in parallel
2. **Sorting Phase**: Chunks are sorted by sequence number
3. **Concatenation Phase**: Binary data is concatenated in order
4. **Save Phase**: Merged file is created as a blob and downloaded

## Usage Example

### Watching a Video on Instagram

1. Navigate to Instagram and play a video
2. Open the extension popup
3. You'll see the video appear with a yellow "X chunks" badge
4. Wait for all chunks to be detected (count will increase)
5. Click "Merge & Download (X chunks)" button
6. Choose where to save the merged video file

## Technical Details

### Chunk Detection Pattern

```javascript
// URLs like these are detected as chunks:
- https://example.com/video/segment_001.ts
- https://example.com/stream/chunk123.m4s
- https://cdn.example.com/hls/00042.ts
```

### Sequence Number Extraction

The extension tries multiple patterns to extract sequence numbers:

```javascript
/segment[_-]?(\d+)/i    // segment_123, segment-456
/chunk[_-]?(\d+)/i      // chunk_789, chunk-012
/(\d+)\.(ts|m4s)/i      // 00123.ts, 456.m4s
/seg(\d+)/i             // seg789
```

### Base URL Grouping

Chunks are grouped by removing the segment-specific part:

```javascript
URL: https://example.com/video/hls/segment_001.ts
Base: https://example.com/video/hls/

URL: https://example.com/video/hls/segment_002.ts
Base: https://example.com/video/hls/

// Both chunks will be grouped together
```

## Troubleshooting

### Chunks Not Being Detected

**Problem**: Extension doesn't show chunked videos

**Solutions**:
- Ensure the video is using streaming (not direct MP4)
- Wait for the video to start playing completely
- Refresh the page and try again
- Check browser console for detection logs

### Incomplete Chunk Collection

**Problem**: Not all chunks are detected before download

**Solutions**:
- Let the video play fully before downloading
- Some streaming services may use adaptive bitrates - try different quality settings
- The extension keeps last 50 media items; older chunks may be removed

### Merged Video Won't Play

**Problem**: Downloaded file doesn't play properly

**Solutions**:
- Ensure all chunks were downloaded (check console logs)
- Try a different media player (VLC is recommended)
- Some streams use encryption - these cannot be merged
- Verify the chunks were in the correct sequence

### Large Memory Usage

**Problem**: Browser becomes slow during merge

**Solutions**:
- The extension processes chunks in memory
- For very large videos (>500 chunks), consider:
  - Downloading in smaller sections
  - Using a dedicated download manager
  - Increasing available browser memory

## Limitations

1. **Encrypted Streams**: DRM-protected content cannot be merged
2. **Memory Constraints**: Very large videos may cause memory issues
3. **Missing Chunks**: If chunks are removed from server, merge will fail
4. **Codec Compatibility**: Merged file inherits original codec - player must support it

## Console Logs

The extension logs chunk detection activity:

```
[Media Downloader] Detected chunk: https://example.com/segment_001.ts seq: 1
[Media Downloader] Chunk added: 5 chunks total
[Media Downloader] Starting merge of 10 chunks
[Media Downloader] Successfully downloaded 10 chunks
[Media Downloader] Merged 10 chunks into 15728640 bytes
[Media Downloader] Merged video download initiated: instagram_video_2024-02-15.ts
```

Monitor these logs in the browser console (F12) for troubleshooting.

## Best Practices

1. **Wait for Complete Playback**: Let the video play fully to detect all chunks
2. **Download Promptly**: Chunks may expire on CDN servers
3. **Check Chunk Count**: Ensure the count seems reasonable (typically 10-100 chunks)
4. **Use Quality Media Players**: VLC or similar for best compatibility
5. **Monitor Console**: Watch for errors during detection/merge

## Future Enhancements

Potential improvements for this feature:

- [ ] Progress bar during merge operation
- [ ] Estimated file size display
- [ ] Automatic quality selection
- [ ] Playlist parsing for better chunk prediction
- [ ] Background merging without blocking UI
- [ ] Chunk caching to prevent re-downloads

---

**Note**: This feature is designed for personal use with content you have rights to download. Always respect copyright and platform terms of service.
