"use client";

import { Option } from "effect";
import * as XLSX from "xlsx";

import type {
  ClipLibrary,
  PlannedSlot,
  PlannedVideo,
  PlannedVideoId,
  VoiceClip,
} from "@/contexts/composition";
import type {
  ClipId,
  MediaUrl,
  Seconds,
  ShotCategory,
  SourceVideoId,
  VoiceId,
} from "@/contexts/shared-kernel";
import type { RenderVideoPayload } from "@/shared/lib/render-client";

import type { RenderedRecord } from "../domain/types";

export interface HistorySlotView {
  readonly category: ShotCategory;
  readonly label: string;
  readonly clipId: string;
  readonly localUrl: string;
  readonly localPath?: string | undefined;
  readonly driveUrl?: string | undefined;
  readonly videoBegin: number;
  readonly videoEnd: number;
  readonly originalVideoEnd?: number | undefined;
  readonly speed: number;
  readonly flipH: boolean;
  readonly effectiveDuration: number;
}

export interface RenderedPayloadView {
  readonly finalDuration: number | null;
  readonly slots: ReadonlyArray<HistorySlotView>;
  readonly voiceId: string | null;
  readonly voiceName: string | null;
}

export const HISTORY_CATEGORY_META: Record<
  ShotCategory,
  {
    readonly prefix: string;
    readonly title: string;
    readonly borderClass: string;
    readonly textClass: string;
  }
> = {
  open: {
    prefix: "O:",
    title: "1. Open (Hook)",
    borderClass: "border-rose-500/70",
    textClass: "text-rose-300",
  },
  product: {
    prefix: "P:",
    title: "2. Product",
    borderClass: "border-sky-500/70",
    textClass: "text-sky-300",
  },
  texture: {
    prefix: "T:",
    title: "3. Texture",
    borderClass: "border-amber-500/70",
    textClass: "text-amber-300",
  },
  apply: {
    prefix: "A:",
    title: "4. Apply / Use",
    borderClass: "border-emerald-500/70",
    textClass: "text-emerald-300",
  },
  end: {
    prefix: "E:",
    title: "5. End (CTA)",
    borderClass: "border-violet-500/70",
    textClass: "text-violet-300",
  },
};

export const ORDERED_CATEGORIES: ReadonlyArray<ShotCategory> = [
  "open",
  "product",
  "texture",
  "apply",
  "end",
];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const asStr = (v: unknown): string => (typeof v === "string" ? v : "");

const asNum = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const extractDriveUrl = (driveFileId: string, localUrl: string): string | undefined => {
  if (driveFileId) {
    return `https://drive.google.com/file/d/${driveFileId}/view`;
  }
  const match = /\/api\/drive-stream\/([^/?#]+)/.exec(localUrl);
  const extracted = match?.[1];
  return extracted ? `https://drive.google.com/file/d/${extracted}/view` : undefined;
};

const extractVoiceId = (raw: unknown): string | null => {
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  if (isRecord(raw)) {
    if (raw._tag === "Some" && typeof raw.value === "string") {
      return raw.value.trim() || null;
    }
    if (typeof raw.id === "string" && raw.id.trim().length > 0) {
      return raw.id.trim();
    }
  }
  return null;
};

const extractEmbeddedVoiceName = (payload: Record<string, unknown> | null): string | null => {
  if (!payload) return null;
  if (typeof payload.voiceName === "string" && payload.voiceName.trim()) {
    return payload.voiceName.trim();
  }
  if (
    isRecord(payload.voiceTrack) &&
    typeof payload.voiceTrack.name === "string" &&
    payload.voiceTrack.name.trim()
  ) {
    return payload.voiceTrack.name.trim();
  }
  if (
    isRecord(payload.voice) &&
    typeof payload.voice.name === "string" &&
    payload.voice.name.trim()
  ) {
    return payload.voice.name.trim();
  }
  return null;
};

const normalizePayloadRecord = (raw: unknown): Record<string, unknown> | null => {
  if (isRecord(raw)) return raw;
  if (typeof raw === "string" && raw.trim().startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const toShotCategory = (raw: unknown, idx: number): ShotCategory => {
  if (
    raw === "open" ||
    raw === "product" ||
    raw === "texture" ||
    raw === "apply" ||
    raw === "end"
  ) {
    return raw;
  }
  return ORDERED_CATEGORIES[idx] ?? "open";
};

export function extractRenderedPayload(
  record: RenderedRecord,
  voices: ReadonlyArray<VoiceClip>,
): RenderedPayloadView {
  const payload = normalizePayloadRecord(record.payload);
  const rawSlots = Array.isArray(payload?.slots) ? payload.slots : [];

  const slots: ReadonlyArray<HistorySlotView> = rawSlots.map((raw, idx) => {
    const item = isRecord(raw) ? raw : {};
    const category = toShotCategory(item.category, idx);
    const label = asStr(item.shotLabel) || asStr(item.clipLabel) || asStr(item.label);
    const clipId = asStr(item.clipId) || asStr(item.shotId) || `${record.id}_slot_${String(idx)}`;
    const localUrl = asStr(item.localUrl);
    const localPath = asStr(item.localPath) || undefined;
    const driveFileId = asStr(item.driveFileId);
    const driveUrl = extractDriveUrl(driveFileId, localUrl);
    const videoBegin = Math.max(0, asNum(item.videoBegin, 0));
    const videoEnd = Math.max(videoBegin + 0.1, asNum(item.videoEnd, videoBegin + 4));
    const originalVideoEnd =
      typeof item.originalVideoEnd === "number" && Number.isFinite(item.originalVideoEnd)
        ? item.originalVideoEnd
        : undefined;
    const speed = Math.max(0.25, asNum(item.speed, 1));
    const flipH = Boolean(item.flipH);
    const effectiveDuration = Number(((videoEnd - videoBegin) / speed).toFixed(2));

    return {
      category,
      label,
      clipId,
      localUrl,
      localPath,
      driveUrl,
      videoBegin,
      videoEnd,
      originalVideoEnd,
      speed,
      flipH,
      effectiveDuration,
    };
  });

  const voiceId =
    extractVoiceId(payload?.voiceTrackId) ??
    extractVoiceId(payload?.voiceId) ??
    extractVoiceId(payload?.voiceTrack) ??
    extractVoiceId(payload?.voice);
  const matchedVoice = voiceId
    ? voices.find((v) => v.id === voiceId || v.name === voiceId || v.fileName === voiceId)
    : undefined;
  const embeddedName = extractEmbeddedVoiceName(payload);
  const voiceName = matchedVoice?.name ?? embeddedName ?? (voiceId ? "Voice" : null);

  const rawDuration = payload?.finalDuration;
  const computedDuration =
    typeof rawDuration === "number" && Number.isFinite(rawDuration) && rawDuration > 0
      ? rawDuration
      : slots.length > 0
        ? Number(slots.reduce((acc, s) => acc + s.effectiveDuration, 0).toFixed(2))
        : null;

  return {
    finalDuration: computedDuration,
    slots,
    voiceId,
    voiceName,
  };
}

export function formatRenderedDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

export function toPlannedVideoFromRecord(
  record: RenderedRecord,
  view: RenderedPayloadView,
): PlannedVideo | null {
  if (view.slots.length === 0) return null;
  let cursor = 0;
  const plannedSlots: Array<PlannedSlot> = view.slots.map((s) => {
    const enterBegin = Number(cursor.toFixed(2)) as Seconds;
    cursor += s.effectiveDuration;
    const exitEnd = Number(cursor.toFixed(2)) as Seconds;
    return {
      category: s.category,
      clipId: s.clipId as ClipId,
      clipLabel: s.label || s.category,
      sourceVideoId: s.clipId as SourceVideoId,
      localUrl: s.localUrl as MediaUrl,
      enterBegin,
      exitEnd,
      videoBegin: s.videoBegin as Seconds,
      videoEnd: s.videoEnd as Seconds,
      ...(s.originalVideoEnd !== undefined
        ? { originalVideoEnd: s.originalVideoEnd as Seconds }
        : {}),
      speed: s.speed,
      flipH: s.flipH,
    };
  });

  const firstSlot = plannedSlots.at(0);
  if (!firstSlot) return null;
  const restSlots = plannedSlots.slice(1);

  const findId = (cat: ShotCategory, fallbackIdx: number): ClipId => {
    const byCat = plannedSlots.find((s) => s.category === cat);
    if (byCat) return byCat.clipId;
    const byIdx = plannedSlots.at(fallbackIdx);
    if (byIdx) return byIdx.clipId;
    return `${record.id}_${cat}` as ClipId;
  };

  const totalVisualDuration = Math.max(0.1, Number(cursor.toFixed(2))) as Seconds;
  const finalDuration = Math.max(0.1, view.finalDuration ?? cursor) as Seconds;

  return {
    id: record.id as string as PlannedVideoId,
    name: record.name,
    tupleKey: record.tupleKey,
    tuple: {
      open: findId("open", 0),
      product: findId("product", 1),
      texture: findId("texture", 2),
      apply: findId("apply", 3),
      end: findId("end", 4),
    },
    slots: [firstSlot, ...restSlots],
    voiceId: view.voiceId ? Option.some(view.voiceId as VoiceId) : Option.none(),
    totalVisualDuration,
    finalDuration,
    syncMode: "video_master",
  };
}

export function toRenderVideoPayloadFromRecord(
  record: RenderedRecord,
  view: RenderedPayloadView,
  library?: ClipLibrary,
): RenderVideoPayload | null {
  if (view.slots.length === 0) return null;
  const findLocalPath = (clipId: string): string | undefined => {
    if (!library) return undefined;
    for (const list of Object.values(library)) {
      const found = list.find((c) => c.id === clipId);
      if (found && found.source._tag === "LocalClip") {
        return found.source.localPath;
      }
    }
    return undefined;
  };

  return {
    id: record.id,
    name: record.name,
    ...(view.voiceId ? { voiceTrackId: view.voiceId } : {}),
    slots: view.slots.map((s) => ({
      category: s.category,
      localPath: s.localPath ?? findLocalPath(s.clipId),
      localUrl: s.localUrl,
      videoBegin: s.videoBegin,
      videoEnd: s.videoEnd,
      speed: s.speed,
      flipH: s.flipH,
    })),
  };
}

export function exportHistoryFile(
  records: ReadonlyArray<RenderedRecord>,
  voices: ReadonlyArray<VoiceClip>,
  format: "xlsx" | "csv",
): void {
  const rows = records.map((rec, idx) => {
    const view = extractRenderedPayload(rec, voices);
    const byCat = (cat: ShotCategory) => view.slots.find((s) => s.category === cat);
    const open = byCat("open");
    const product = byCat("product");
    const texture = byCat("texture");
    const apply = byCat("apply");
    const end = byCat("end");

    return {
      STT: idx + 1,
      "Tên video": rec.name,
      "Trạng thái": rec.status === "used" ? "Đã sử dụng" : "Chưa sử dụng",
      "Thời lượng (s)": view.finalDuration !== null ? view.finalDuration.toFixed(1) : "",
      "1. Open (Hook)": open?.label ?? "",
      "Link Open": open?.driveUrl ?? "",
      "2. Product": product?.label ?? "",
      "Link Product": product?.driveUrl ?? "",
      "3. Texture": texture?.label ?? "",
      "Link Texture": texture?.driveUrl ?? "",
      "4. Apply / Use": apply?.label ?? "",
      "Link Apply / Use": apply?.driveUrl ?? "",
      "5. End (CTA)": end?.label ?? "",
      "Link End (CTA)": end?.driveUrl ?? "",
      Voice: view.voiceName ?? "",
      "Mã tổ hợp": rec.tupleKey,
      "Thời gian render": formatRenderedDateTime(rec.renderedAt),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lich su render");
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    XLSX.writeFile(wb, `lich-su-render-${stamp}.csv`, { bookType: "csv" });
  } else {
    XLSX.writeFile(wb, `lich-su-render-${stamp}.xlsx`);
  }
}
