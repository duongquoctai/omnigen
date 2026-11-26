export interface RenderProgressSnapshot {
  readonly active: boolean;
  readonly current: number;
  readonly total: number;
  readonly percent: number;
  readonly current_name: string;
}

export interface RenderSlotPayload {
  readonly category: string;
  readonly localPath?: string | undefined;
  readonly localUrl?: string | undefined;
  readonly videoBegin: number;
  readonly videoEnd: number;
  readonly speed: number;
  readonly flipH: boolean;
}

export interface RenderVideoPayload {
  readonly id: string;
  readonly name: string;
  readonly voiceTrackId?: string | undefined;
  readonly slots: ReadonlyArray<RenderSlotPayload>;
}

export interface RenderVoicePayload {
  readonly id: string;
  readonly localPath?: string | undefined;
  readonly localUrl: string;
}

export interface RenderBatchResult {
  readonly fileName: string;
  readonly contentType: string;
}

const DEFAULT_PROGRESS: RenderProgressSnapshot = {
  active: false,
  current: 0,
  total: 0,
  percent: 0,
  current_name: "",
};

export function pollRenderProgress(sessionId: string): Promise<RenderProgressSnapshot> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const query = encodeURIComponent(sessionId);
    xhr.open("GET", `/api/render-progress?sessionId=${query}`, true);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText || "{}") as Partial<RenderProgressSnapshot>;
          resolve({
            active: Boolean(parsed.active),
            current: parsed.current ?? 0,
            total: parsed.total ?? 0,
            percent: parsed.percent ?? 0,
            current_name: parsed.current_name ?? "",
          });
          return;
        } catch {
          resolve(DEFAULT_PROGRESS);
          return;
        }
      }
      resolve(DEFAULT_PROGRESS);
    };
    xhr.onerror = () => {
      resolve(DEFAULT_PROGRESS);
    };
    xhr.send();
  });
}

const triggerBlobDownload = (blob: Blob, fileName: string): void => {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

export function renderComposedBatch(params: {
  readonly sessionId: string;
  readonly videos: ReadonlyArray<RenderVideoPayload>;
  readonly voices: ReadonlyArray<RenderVoicePayload>;
}): Promise<RenderBatchResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/render-composed", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("x-session-id", params.sessionId);
    xhr.responseType = "blob";

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const blob = xhr.response as Blob;
        const contentType = xhr.getResponseHeader("content-type") ?? "video/mp4";
        const isZip = contentType.includes("application/zip");
        const firstVideoName = params.videos.at(0)?.name ?? "rendered";
        const fileName = isZip
          ? `lachvid_rendered_${params.sessionId}.zip`
          : `${firstVideoName}.mp4`;
        triggerBlobDownload(blob, fileName);
        resolve({ fileName, contentType });
        return;
      }
      reject(new Error(`Lỗi render (${String(xhr.status)})`));
    };

    xhr.onerror = () => {
      reject(new Error("Không thể kết nối tới dịch vụ render."));
    };

    xhr.send(
      JSON.stringify({
        sessionId: params.sessionId,
        videos: params.videos,
        multiVoiceTracks: params.voices,
      }),
    );
  });
}
