import { Option } from "effect";

import type {
  ClipId,
  FolderId,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotCategory,
  VoiceId,
} from "@/contexts/shared-kernel";
import { readVideoMetadata, uploadFileInChunks } from "@/shared/lib/chunked-upload";

import type { Clip, VoiceClip } from "../domain/types";

export async function uploadCategoryFiles(params: {
  readonly folderId: FolderId;
  readonly category: ShotCategory;
  readonly files: FileList;
  readonly onProgressText: (text: string) => void;
}): Promise<ReadonlyArray<Clip>> {
  const list = Array.from(params.files).filter(
    (f) => f.type.startsWith("video/") || /\.(mp4|mov|mkv|webm|avi)$/i.test(f.name),
  );
  const added: Array<Clip> = [];
  for (const [i, file] of list.entries()) {
    params.onProgressText(
      `Đang tải lên ${params.category} (${String(i + 1)}/${String(list.length)}): ${file.name}`,
    );
    const meta = await readVideoMetadata(file);
    const res = await uploadFileInChunks(file, {
      endpoint: "/api/upload-local",
      sessionId: params.folderId,
      projectId: params.folderId,
      targetCategory: params.category,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
    });
    if (res.url) {
      added.push({
        id: `clip_${String(Date.now())}_${String(i)}` as ClipId,
        name: file.name.replace(/\.[^.]+$/, ""),
        fileName: res.fileName ?? file.name,
        category: params.category,
        duration: Math.max(0.2, res.duration ?? meta.duration) as Seconds,
        source: {
          _tag: "LocalClip",
          localPath: (res.localPath ?? res.url) as LocalPath,
          localUrl: res.url as MediaUrl,
        },
        lockFlipH: false,
        contentHash: Option.none(),
      });
    }
  }
  return added;
}

export async function uploadVoiceFiles(params: {
  readonly folderId: FolderId;
  readonly files: FileList;
}): Promise<ReadonlyArray<VoiceClip>> {
  const list = Array.from(params.files);
  const added: Array<VoiceClip> = [];
  for (const [i, file] of list.entries()) {
    const res = await uploadFileInChunks(file, {
      endpoint: "/api/upload-local",
      sessionId: params.folderId,
      projectId: params.folderId,
      kind: "voice",
    });
    if (res.url) {
      added.push({
        id: `voice_${String(Date.now())}_${String(i)}` as VoiceId,
        name: file.name.replace(/\.[^.]+$/, ""),
        fileName: res.fileName ?? file.name,
        localUrl: res.url as MediaUrl,
        localPath: res.localPath ? Option.some(res.localPath as LocalPath) : Option.none(),
        duration: Math.max(0.5, res.duration ?? 10) as Seconds,
      });
    }
  }
  return added;
}

const detectBucketFromRelativePath = (relPath: string): ShotCategory | "voice" | null => {
  const lower = relPath.toLowerCase();
  if (/(\/|^)(1[._\s-]*)?open(\/|$)/i.test(lower)) return "open";
  if (/(\/|^)(2[._\s-]*)?product(\/|$)/i.test(lower)) return "product";
  if (/(\/|^)(3[._\s-]*)?texture(\/|$)/i.test(lower)) return "texture";
  if (/(\/|^)(4[._\s-]*)?(apply|use)(\/|$)/i.test(lower)) return "apply";
  if (/(\/|^)(5[._\s-]*)?end(\/|$)/i.test(lower)) return "end";
  if (/(\/|^)voice(\/|$)/i.test(lower)) return "voice";
  return null;
};

export async function uploadMasterFolderFiles(params: {
  readonly folderId: FolderId;
  readonly files: FileList;
  readonly onProgressText: (text: string) => void;
}): Promise<{
  readonly clipsByCategory: Record<ShotCategory, Array<Clip>>;
  readonly voices: Array<VoiceClip>;
}> {
  const clipsByCategory: Record<ShotCategory, Array<Clip>> = {
    open: [],
    product: [],
    texture: [],
    apply: [],
    end: [],
  };
  const voices: Array<VoiceClip> = [];
  const list = Array.from(params.files);

  for (const [i, file] of list.entries()) {
    const rel = file.webkitRelativePath || file.name;
    const bucket = detectBucketFromRelativePath(rel);
    if (!bucket) continue;

    if (bucket === "voice") {
      if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)) {
        continue;
      }
      params.onProgressText(
        `Đang tải voice (${String(i + 1)}/${String(list.length)}): ${file.name}`,
      );
      const meta = await readVideoMetadata(file);
      const res = await uploadFileInChunks(file, {
        endpoint: "/api/upload-local",
        sessionId: params.folderId,
        projectId: params.folderId,
        kind: "voice",
        duration: meta.duration,
      });
      if (res.url) {
        voices.push({
          id: `voice_${String(Date.now())}_${String(i)}` as VoiceId,
          name: file.name.replace(/\.[^.]+$/, ""),
          fileName: res.fileName ?? file.name,
          localUrl: res.url as MediaUrl,
          localPath: res.localPath ? Option.some(res.localPath as LocalPath) : Option.none(),
          duration: Math.max(0.5, res.duration ?? meta.duration) as Seconds,
        });
      }
      continue;
    }

    if (!file.type.startsWith("video/") && !/\.(mp4|mov|mkv|webm|avi)$/i.test(file.name)) {
      continue;
    }
    params.onProgressText(
      `Đang tải lên ${bucket.toUpperCase()} (${String(i + 1)}/${String(list.length)}): ${file.name}`,
    );
    const meta = await readVideoMetadata(file);
    const res = await uploadFileInChunks(file, {
      endpoint: "/api/upload-local",
      sessionId: params.folderId,
      projectId: params.folderId,
      targetCategory: bucket,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
    });
    if (res.url) {
      clipsByCategory[bucket].push({
        id: `clip_${String(Date.now())}_${String(i)}` as ClipId,
        name: file.name.replace(/\.[^.]+$/, ""),
        fileName: res.fileName ?? file.name,
        category: bucket,
        duration: Math.max(0.2, res.duration ?? meta.duration) as Seconds,
        source: {
          _tag: "LocalClip",
          localPath: (res.localPath ?? res.url) as LocalPath,
          localUrl: res.url as MediaUrl,
        },
        lockFlipH: false,
        contentHash: Option.none(),
      });
    }
  }

  return { clipsByCategory, voices };
}
