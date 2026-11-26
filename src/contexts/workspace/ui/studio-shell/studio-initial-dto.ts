import { Option } from "effect";

import type { Clip, ClipLibrary, DriveFileId, VoiceClip } from "@/contexts/composition";
import type { CategoryMinDurations, Shot, SourceVideo, Speed, TimeRange } from "@/contexts/footage";
import type { RenderedRecord, RenderedRecordId } from "@/contexts/rendering";
import type {
  ClipId,
  FolderId,
  LocalPath,
  MediaUrl,
  Seconds,
  ShotCategory,
  ShotId,
  SourceVideoId,
  VoiceId,
} from "@/contexts/shared-kernel";

export interface PlainClipDto {
  readonly id: string;
  readonly name: string;
  readonly fileName: string;
  readonly category: ShotCategory;
  readonly duration: number;
  readonly localUrl: string;
  readonly localPath?: string | undefined;
  readonly driveFileId?: string | undefined;
  readonly lockFlipH?: boolean | undefined;
}

export interface PlainLibraryDto {
  readonly open: ReadonlyArray<PlainClipDto>;
  readonly product: ReadonlyArray<PlainClipDto>;
  readonly texture: ReadonlyArray<PlainClipDto>;
  readonly apply: ReadonlyArray<PlainClipDto>;
  readonly end: ReadonlyArray<PlainClipDto>;
}

export interface PlainVoiceDto {
  readonly id: string;
  readonly name: string;
  readonly fileName: string;
  readonly localUrl: string;
  readonly localPath?: string | undefined;
  readonly duration: number;
}

export interface PlainRenderedRecordDto {
  readonly id: string;
  readonly folderId: string;
  readonly tupleKey: string;
  readonly name: string;
  readonly outputUrl?: string | undefined;
  readonly status: "unused" | "used";
  readonly renderedAt: string;
  readonly payload?: unknown;
}

export interface PlainSourceVideoDto {
  readonly id: string;
  readonly name: string;
  readonly fileName: string;
  readonly localUrl: string;
  readonly localPath: string;
  readonly duration: number;
  readonly width: number;
  readonly height: number;
  readonly sizeBytes: number;
  readonly createdAt: string;
}

export interface PlainShotDto {
  readonly id: string;
  readonly sourceVideoId: string;
  readonly label: string;
  readonly category?: ShotCategory | undefined;
  readonly begin: number;
  readonly end: number;
  readonly speed?: number | undefined;
  readonly flipH?: boolean | undefined;
  readonly lockFlipH?: boolean | undefined;
}

export type PlainCategoryMinDurationsDto = Record<ShotCategory, number>;

const mapClipDto = (item: PlainClipDto): Clip => ({
  id: item.id as ClipId,
  name: item.name || "Clip",
  fileName: item.fileName || "clip.mp4",
  category: item.category,
  duration: Math.max(0.1, item.duration || 4) as Seconds,
  source: item.driveFileId
    ? {
        _tag: "DriveClip",
        fileId: item.driveFileId as DriveFileId,
        streamUrl: item.localUrl as MediaUrl,
      }
    : {
        _tag: "LocalClip",
        localPath: (item.localPath ?? item.localUrl) as LocalPath,
        localUrl: item.localUrl as MediaUrl,
      },
  lockFlipH: Boolean(item.lockFlipH),
  contentHash: Option.none(),
});

export function hydrateLibraryFromDto(dto: PlainLibraryDto): ClipLibrary {
  return {
    open: dto.open.map(mapClipDto),
    product: dto.product.map(mapClipDto),
    texture: dto.texture.map(mapClipDto),
    apply: dto.apply.map(mapClipDto),
    end: dto.end.map(mapClipDto),
  };
}

export function hydrateVoicesFromDto(dto: ReadonlyArray<PlainVoiceDto>): ReadonlyArray<VoiceClip> {
  return dto.map((v) => ({
    id: v.id as VoiceId,
    name: v.name || "Voice",
    fileName: v.fileName || "voice.mp3",
    localUrl: v.localUrl as MediaUrl,
    localPath: v.localPath ? Option.some(v.localPath as LocalPath) : Option.none(),
    duration: Math.max(0.5, v.duration || 10) as Seconds,
  }));
}

export function hydrateRecordsFromDto(
  dto: ReadonlyArray<PlainRenderedRecordDto>,
): ReadonlyArray<RenderedRecord> {
  return dto.map((rv) => ({
    id: rv.id as RenderedRecordId,
    folderId: rv.folderId as FolderId,
    tupleKey: rv.tupleKey,
    name: rv.name || "Video đã render",
    outputUrl: rv.outputUrl ? Option.some(rv.outputUrl as MediaUrl) : Option.none(),
    status: rv.status === "used" ? "used" : "unused",
    renderedAt: rv.renderedAt,
    ...(rv.payload !== undefined ? { payload: rv.payload } : {}),
  }));
}

export function hydrateSourceVideoFromDto(
  dto: PlainSourceVideoDto | null | undefined,
): SourceVideo | null {
  if (!dto) return null;
  return {
    id: dto.id as SourceVideoId,
    name: dto.name || dto.fileName,
    fileName: dto.fileName,
    localUrl: dto.localUrl as MediaUrl,
    localPath: dto.localPath as LocalPath,
    duration: Math.max(0.1, dto.duration || 1) as Seconds,
    width: Math.max(1, dto.width || 576),
    height: Math.max(1, dto.height || 1024),
    sizeBytes: Math.max(0, dto.sizeBytes || 0),
    createdAt: dto.createdAt || "",
  };
}

export function hydrateShotsFromDto(
  dto: ReadonlyArray<PlainShotDto> | undefined,
): ReadonlyArray<Shot> {
  if (!dto || dto.length === 0) return [];
  return dto.map((s) => {
    const begin = Math.max(0, s.begin) as Seconds;
    const end = Math.max(begin + 0.1, s.end) as Seconds;
    const range = { begin, end } as TimeRange;
    const locked = Boolean(s.lockFlipH);
    const edits = {
      flip: s.flipH
        ? ({ _tag: "Flipped", locked } as const)
        : ({ _tag: "Unflipped", locked } as const),
      speed: Math.min(10, Math.max(0.1, s.speed ?? 1)) as Speed,
      zoom: { _tag: "NoZoom" } as const,
      crop: Option.none(),
      transition: { _tag: "NoTransition" } as const,
    };
    const base = {
      id: s.id as ShotId,
      sourceVideoId: s.sourceVideoId as SourceVideoId,
      label: s.label || "Cảnh",
      range,
      detectedRange: range,
      contentHash: Option.none(),
      edits,
    };
    if (s.category) {
      return {
        ...base,
        _tag: "ClassifiedShot",
        category: s.category,
      };
    }
    return {
      ...base,
      _tag: "DraftShot",
    };
  });
}

export function hydrateMinDurationsFromDto(
  dto: PlainCategoryMinDurationsDto | undefined,
): CategoryMinDurations | undefined {
  if (!dto) return undefined;
  return {
    open: dto.open as Seconds,
    product: dto.product as Seconds,
    texture: dto.texture as Seconds,
    apply: dto.apply as Seconds,
    end: dto.end as Seconds,
  };
}
