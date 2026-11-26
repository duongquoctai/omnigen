export interface ChunkedUploadOptions {
  readonly endpoint?: string | undefined;
  readonly sessionId: string;
  readonly projectId?: string | undefined;
  readonly kind?: "source" | "voice" | undefined;
  readonly targetCategory?: string | undefined;
  readonly relativePath?: string | undefined;
  readonly duration?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly onProgress?: ((loaded: number, total: number) => void) | undefined;
}

export interface ChunkedUploadResult {
  readonly ok?: boolean | undefined;
  readonly url?: string | undefined;
  readonly localPath?: string | undefined;
  readonly fileName?: string | undefined;
  readonly duration?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
  readonly error?: string | undefined;
}

export interface VideoMetadata {
  readonly duration: number;
  readonly width: number;
  readonly height: number;
}

const CHUNK_SIZE = 20 * 1024 * 1024;

const generateUploadId = (): string =>
  `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

interface RawUploadMedia {
  readonly localUrl?: string | undefined;
  readonly localPath?: string | undefined;
  readonly fileName?: string | undefined;
  readonly duration?: number | undefined;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

interface RawChunkedUploadResponse extends ChunkedUploadResult {
  readonly sourceVideo?: RawUploadMedia | undefined;
  readonly voiceTrack?: RawUploadMedia | undefined;
}

const normalizeUploadResult = (raw: RawChunkedUploadResponse): ChunkedUploadResult => {
  const media = raw.sourceVideo ?? raw.voiceTrack;
  const resolvedUrl = raw.url ?? media?.localUrl;
  const resolvedPath = raw.localPath ?? media?.localPath;
  const resolvedFileName = raw.fileName ?? media?.fileName;
  const resolvedDuration = raw.duration ?? media?.duration;
  const resolvedWidth = raw.width ?? media?.width;
  const resolvedHeight = raw.height ?? media?.height;

  return {
    ok: raw.ok,
    ...(resolvedUrl !== undefined ? { url: resolvedUrl } : {}),
    ...(resolvedPath !== undefined ? { localPath: resolvedPath } : {}),
    ...(resolvedFileName !== undefined ? { fileName: resolvedFileName } : {}),
    ...(resolvedDuration !== undefined ? { duration: resolvedDuration } : {}),
    ...(resolvedWidth !== undefined ? { width: resolvedWidth } : {}),
    ...(resolvedHeight !== undefined ? { height: resolvedHeight } : {}),
    ...(raw.error !== undefined ? { error: raw.error } : {}),
  };
};

const sendChunkXhr = (
  endpoint: string,
  headers: Readonly<Record<string, string>>,
  chunkBlob: Blob,
  onChunkProgress: (loaded: number) => void,
): Promise<ChunkedUploadResult> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onChunkProgress(ev.loaded);
      }
    };
    xhr.onload = () => {
      try {
        const parsed = JSON.parse(xhr.responseText || "{}") as RawChunkedUploadResponse;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(normalizeUploadResult(parsed));
        } else {
          reject(new Error(parsed.error ?? `Upload failed (${String(xhr.status)})`));
        }
      } catch {
        reject(new Error(`Upload failed (${String(xhr.status)})`));
      }
    };
    xhr.onerror = () => {
      reject(new Error("Lỗi kết nối khi tải file lên máy chủ."));
    };
    xhr.send(chunkBlob);
  });

export async function uploadFileInChunks(
  file: File,
  options: ChunkedUploadOptions,
): Promise<ChunkedUploadResult> {
  const endpoint = options.endpoint ?? "/api/upload-local";
  const totalBytes = Math.max(1, file.size);
  const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
  const uploadId = generateUploadId();
  let lastData: ChunkedUploadResult = {};

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(file.size, start + CHUNK_SIZE);
    const chunkBlob = file.slice(start, end);

    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
      "x-session-id": options.sessionId,
      "x-upload-id": uploadId,
      "x-chunk-index": String(chunkIndex),
      "x-total-chunks": String(totalChunks),
      "x-file-name": encodeURIComponent(file.name),
      "x-file-size": String(file.size),
    };
    if (options.projectId) headers["x-project-id"] = options.projectId;
    if (options.kind) headers["x-upload-kind"] = options.kind;
    if (options.targetCategory) headers["x-target-category"] = options.targetCategory;
    if (options.relativePath) headers["x-relative-path"] = encodeURIComponent(options.relativePath);
    if (options.duration !== undefined) headers["x-video-duration"] = String(options.duration);
    if (options.width !== undefined) headers["x-video-width"] = String(options.width);
    if (options.height !== undefined) headers["x-video-height"] = String(options.height);

    let attempt = 0;
    let lastError: unknown = null;
    let completed = false;

    while (attempt < 3 && !completed) {
      attempt += 1;
      try {
        lastData = await sendChunkXhr(endpoint, headers, chunkBlob, (chunkLoaded) => {
          options.onProgress?.(Math.min(totalBytes, start + chunkLoaded), totalBytes);
        });
        options.onProgress?.(Math.min(totalBytes, end), totalBytes);
        completed = true;
      } catch (err) {
        lastError = err;
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }
    }

    if (!completed) {
      throw lastError instanceof Error
        ? lastError
        : new Error("Không thể tải lên phân mảnh video.");
    }
  }

  return lastData;
}

export function readVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    const fallback: VideoMetadata = { duration: 38, width: 1080, height: 1920 };
    if (typeof document === "undefined" || typeof URL === "undefined") {
      resolve(fallback);
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 38;
      const width = video.videoWidth > 0 ? video.videoWidth : 1080;
      const height = video.videoHeight > 0 ? video.videoHeight : 1920;
      URL.revokeObjectURL(url);
      resolve({ duration, width, height });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(fallback);
    };
    video.src = url;
  });
}
