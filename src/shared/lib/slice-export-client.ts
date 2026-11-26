import JSZip from "jszip";

export interface ExportShotItem {
  readonly id: string;
  readonly label: string;
  readonly category: "open" | "product" | "texture" | "apply" | "end";
  readonly begin: number;
  readonly end: number;
  readonly speed: number;
  readonly flipH: boolean;
  readonly lockFlipH: boolean;
}

export interface SliceExportRequest {
  readonly sessionId: string;
  readonly filePath?: string | undefined;
  readonly categoryMinDurations: Record<string, number>;
  readonly shots: ReadonlyArray<ExportShotItem>;
}

interface DirectoryHandleLike {
  readonly name: string;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<DirectoryHandleLike>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<{
    createWritable: () => Promise<{
      write: (data: Uint8Array<ArrayBuffer>) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

interface WindowWithDirPicker {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<DirectoryHandleLike>;
}

const SLICE_SCENES_URL = "/api/slice-scenes";
const PROJECT_API_URL = "/api/project";

async function fetchSliceZipBlob(req: SliceExportRequest): Promise<Blob> {
  const response = await fetch(SLICE_SCENES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: req.sessionId,
      ...(req.filePath ? { filePath: req.filePath } : {}),
      categoryMinDurations: req.categoryMinDurations,
      scenes: req.shots.map((s) => ({
        id: s.id,
        begin: s.begin,
        end: s.end,
        category: s.category,
        label: s.label,
        speed: s.speed,
        flip_h: s.flipH,
        lock_flip_h: s.lockFlipH,
      })),
    }),
  });

  if (!response.ok) {
    const errJson = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errJson?.error ?? `Không thể xuất cảnh cắt (${String(response.status)}).`);
  }

  return response.blob();
}

export async function sliceAndDownloadZip(req: SliceExportRequest): Promise<void> {
  if (req.shots.length === 0) {
    throw new Error("Chưa có cảnh nào được gán category để xuất.");
  }
  const blob = await fetchSliceZipBlob(req);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lachvid_${req.sessionId}_5_folders.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function sliceAndSaveToDirectory(
  req: SliceExportRequest,
): Promise<{ readonly savedCount: number; readonly directoryName: string }> {
  if (req.shots.length === 0) {
    throw new Error("Chưa có cảnh nào được gán category để lưu.");
  }

  const picker = (window as unknown as WindowWithDirPicker).showDirectoryPicker;
  if (!picker) {
    throw new Error(
      "Trình duyệt chưa hỗ trợ lưu trực tiếp vào thư mục (hãy dùng Chrome/Edge bản mới hoặc nút Tải ZIP).",
    );
  }

  const rootDir = await picker({ mode: "readwrite" });
  const blob = await fetchSliceZipBlob(req);
  const zip = await JSZip.loadAsync(blob);

  let savedCount = 0;
  for (const [relativePath, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const parts = relativePath.split("/").filter((p) => p.length > 0);
    if (parts.length === 0) continue;

    let currentDir = rootDir;
    for (let i = 0; i < parts.length - 1; i++) {
      const folderPart = parts.at(i);
      if (folderPart) {
        currentDir = await currentDir.getDirectoryHandle(folderPart, {
          create: true,
        });
      }
    }

    const fileName = parts.at(-1);
    if (!fileName) continue;
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    const bytes = await entry.async("uint8array");
    const bufferCopy = new Uint8Array(bytes.byteLength);
    bufferCopy.set(bytes);
    await writable.write(bufferCopy);
    await writable.close();
    savedCount += 1;
  }

  return { savedCount, directoryName: rootDir.name };
}

export async function resetSourceSession(params: {
  readonly projectId: string;
  readonly sessionId: string;
}): Promise<void> {
  const response = await fetch(PROJECT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "reset_source",
      projectId: params.projectId,
      sessionId: params.sessionId,
    }),
  });
  if (!response.ok) {
    const errJson = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(errJson?.error ?? "Không thể đặt lại video nguồn.");
  }
}
