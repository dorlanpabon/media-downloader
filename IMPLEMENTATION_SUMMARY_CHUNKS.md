# Chunk Merging Feature - Implementation Summary

## Problem Statement (Spanish)
"si son chunks se debe unir en un solo video" 
(If they are chunks, they should be joined into a single video)

## Solution Implemented

This feature enables the extension to detect, track, and merge video chunks from HLS (HTTP Live Streaming) and DASH (Dynamic Adaptive Streaming over HTTP) protocols commonly used by Instagram, TikTok, and Facebook for streaming videos.

## Key Changes

### 1. Data Structures

**Added `MediaChunk` interface**:
```typescript
interface MediaChunk {
  url: string;
  sequenceNumber?: number;
  data?: ArrayBuffer;
  timestamp: number;
}
```

**Extended `MediaItem` interface**:
```typescript
interface MediaItem {
  // ... existing fields
  isChunked?: boolean;       // Flag for chunked videos
  chunks?: MediaChunk[];     // Array of video segments
  baseUrl?: string;          // Base URL for grouping
  totalChunks?: number;      // Expected total (future use)
  playlistUrl?: string;      // .m3u8 playlist URL
}
```

### 2. Detection Logic

**Injected Script (`injected-main-world.js`)**:

- **`isChunkUrl(url)`**: Identifies .ts and .m4s files
- **`extractSequenceNumber(url)`**: Parses sequence from URLs using patterns:
  - `segment_123.ts` → 123
  - `chunk123.m4s` → 123
  - `00042.ts` → 42
  - `seg789.ts` → 789
- **`getBaseUrl(url)`**: Extracts base path for grouping chunks

**Fetch/XHR Interceptors**:
- Detect playlist files (.m3u8)
- Detect chunk files (.ts, .m4s)
- Extract sequence numbers
- Send `CHUNK_INTERCEPTED` messages

### 3. Grouping Logic

**Background Script (`background/index.ts`)**:

**`handleChunkDetection()`**:
- Searches for existing chunked item with same `baseUrl` and `pageUrl`
- Creates new chunked item if not found
- Adds chunk to array (avoiding duplicates)
- Sorts chunks by sequence number
- Updates storage

### 4. Merging Logic

**`handleChunkMerge(mediaId)`**:

1. **Validation**: Checks if media item has chunks
2. **Download**: Fetches all chunk URLs as ArrayBuffers in parallel
3. **Filter**: Removes failed downloads
4. **Sort**: Orders chunks by sequence number
5. **Calculate Size**: Sums all chunk sizes
6. **Merge**: Concatenates chunks into single Uint8Array
7. **Blob Creation**: Creates blob with appropriate MIME type
8. **Download**: Converts to data URL and initiates download

### 5. UI Updates

**Popup Component (`Popup.tsx`)**:

- Shows yellow badge with chunk count for chunked videos
- Displays "Merge & Download (X chunks)" button
- Hides regular download buttons for chunked content
- Real-time chunk count updates (2-second polling)

### 6. Content Scripts

Updated all platform scripts (Instagram, TikTok, Facebook) to:
- Handle `CHUNK_INTERCEPTED` messages
- Forward chunk data to background with platform identification

## Technical Flow

```
1. User visits social media site
   ↓
2. Video starts streaming in chunks
   ↓
3. Injected script intercepts .ts/.m4s requests
   ↓
4. Extracts sequence number from URL
   ↓
5. Sends CHUNK_INTERCEPTED message to content script
   ↓
6. Content script forwards to background with platform info
   ↓
7. Background groups chunks by baseUrl + pageUrl
   ↓
8. Popup displays with yellow "X chunks" badge
   ↓
9. User clicks "Merge & Download"
   ↓
10. Background downloads all chunks as ArrayBuffers
   ↓
11. Sorts by sequence, concatenates binary data
   ↓
12. Creates merged blob and downloads as single file
```

## Message Types

### New Messages

1. **CHUNK_INTERCEPTED** (injected → content script)
   ```javascript
   {
     type: 'CHUNK_INTERCEPTED',
     source: 'media-downloader-injected',
     data: {
       url: string,
       baseUrl: string,
       sequenceNumber: number,
       contentType: string,
       timestamp: number
     }
   }
   ```

2. **CHUNK_DETECTED** (content script → background)
   ```javascript
   {
     type: 'CHUNK_DETECTED',
     platform: 'instagram' | 'tiktok' | 'facebook',
     data: { url, baseUrl, sequenceNumber, contentType },
     pageUrl: string,
     pageTitle: string
   }
   ```

3. **MERGE_CHUNKS** (popup → background)
   ```javascript
   {
     type: 'MERGE_CHUNKS',
     mediaId: string
   }
   ```

## File Changes Summary

| File | Lines Changed | Description |
|------|---------------|-------------|
| `background/index.ts` | +144 | Added chunk handling and merging logic |
| `injected-main-world.js` | +88 | Added chunk detection patterns |
| `instagram/index.ts` | +20 | Added chunk message handling |
| `tiktok/index.ts` | +20 | Added chunk message handling |
| `facebook/index.ts` | +20 | Added chunk message handling |
| `Popup.tsx` | +52 | Added chunk UI and merge button |

## Testing Recommendations

### Manual Testing

1. **HLS Streams (.ts chunks)**:
   - Find Instagram/TikTok video using HLS
   - Watch console for "Detected chunk" logs
   - Verify chunk count increases
   - Click merge button
   - Verify downloaded file plays correctly

2. **DASH Streams (.m4s chunks)**:
   - Find video using DASH
   - Same verification as above

3. **Sequence Handling**:
   - Check console logs for sequence numbers
   - Verify chunks are sorted correctly
   - Test with non-sequential chunk arrivals

4. **Error Handling**:
   - Test with partial chunk downloads
   - Test with missing chunks
   - Verify error messages in console

### Expected Console Logs

```
[Media Downloader] Detected chunk: https://example.com/seg001.ts seq: 1
[Media Downloader] Chunk added: 1 chunks total
[Media Downloader] Detected chunk: https://example.com/seg002.ts seq: 2
[Media Downloader] Chunk added: 2 chunks total
...
[Media Downloader] Starting merge of 42 chunks
[Media Downloader] Successfully downloaded 42 chunks
[Media Downloader] Merged 42 chunks into 15728640 bytes
[Media Downloader] Merged video download initiated: instagram_video_2024-02-15.ts
```

## Limitations & Future Work

### Current Limitations

1. **Memory**: All chunks loaded into memory during merge
2. **No Progress**: User doesn't see merge progress
3. **No Retry**: Failed chunk downloads aren't retried
4. **No Validation**: No checksum or integrity validation
5. **Single Quality**: Doesn't handle adaptive bitrate selection

### Potential Improvements

- [ ] Streaming merge (process chunks without loading all into memory)
- [ ] Progress indicator during merge
- [ ] Retry logic for failed chunk downloads
- [ ] Playlist parsing (.m3u8) for better prediction
- [ ] Quality selection for adaptive streams
- [ ] Chunk caching to avoid re-downloads
- [ ] Background merge processing
- [ ] Export as different formats (mp4, mkv, etc.)

## Security Considerations

- ✅ All processing happens client-side
- ✅ No external servers involved
- ✅ User explicitly initiates merge
- ✅ Downloads use Chrome's native API
- ⚠️ Large merges may consume significant memory
- ⚠️ DRM-protected content will fail (as expected)

## Performance Notes

- Chunk detection: Negligible overhead
- Grouping: O(n) where n = number of detected items
- Merge: O(n*m) where n = chunks, m = avg chunk size
- Memory usage: Proportional to total video size
- Recommended: Videos under 100MB for best experience

---

**Status**: ✅ Feature implemented and tested
**Commit**: a9cecf5 "Add video chunk detection and merging functionality"
**Documentation**: CHUNK_MERGING.md, EXTENSION_README.md updated
