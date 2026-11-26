import "server-only";

import crypto from "node:crypto";

import { Effect, Layer, Option } from "effect";

import type { ContentHash, MediaUrl, Seconds } from "@/contexts/shared-kernel";
import { UpstreamError } from "@/platform/errors";

import type { DriveFileId } from "../domain/types";
import { DriveMediaGateway, type ProbedDriveMedia } from "../workflows/ports";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const parseMp4DurationFromBytes = (bytes: Uint8Array): number | null => {
  for (let i = 0; i + 28 < bytes.length; i += 1) {
    if (
      bytes[i] === 0x6d &&
      bytes[i + 1] === 0x76 &&
      bytes[i + 2] === 0x68 &&
      bytes[i + 3] === 0x64
    ) {
      const version = bytes[i + 4];
      const view = new DataView(bytes.buffer, bytes.byteOffset + i, bytes.byteLength - i);
      if (version === 0 && i + 24 < bytes.length) {
        const timescale = view.getUint32(16, false);
        const duration = view.getUint32(20, false);
        if (timescale > 0 && duration > 0) {
          return Math.round((duration / timescale) * 100) / 100;
        }
      } else if (version === 1 && i + 32 < bytes.length) {
        const timescale = view.getUint32(24, false);
        const hi = view.getUint32(28, false);
        const lo = view.getUint32(32, false);
        const duration = hi * 2 ** 32 + lo;
        if (timescale > 0 && duration > 0) {
          return Math.round((duration / timescale) * 100) / 100;
        }
      }
    }
  }
  return null;
};

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];

const parseMp3DurationFromBytes = (bytes: Uint8Array, totalSizeBytes: number): number | null => {
  if (totalSizeBytes <= 0 || bytes.length < 16) return null;
  let offset = 0;
  if (bytes.at(0) === 0x49 && bytes.at(1) === 0x44 && bytes.at(2) === 0x33) {
    const id3Size =
      (((bytes.at(6) ?? 0) & 0x7f) << 21) |
      (((bytes.at(7) ?? 0) & 0x7f) << 14) |
      (((bytes.at(8) ?? 0) & 0x7f) << 7) |
      ((bytes.at(9) ?? 0) & 0x7f);
    offset = 10 + id3Size;
  }

  for (let i = Math.max(0, offset); i < bytes.length - 4; i += 1) {
    const b1 = bytes.at(i + 1) ?? 0;
    const b2 = bytes.at(i + 2) ?? 0;
    if (bytes.at(i) === 0xff && (b1 & 0xe0) === 0xe0) {
      const versionBits = (b1 >> 3) & 0x03;
      const layerBits = (b1 >> 1) & 0x03;
      const bitrateIdx = (b2 >> 4) & 0x0f;
      const sampleRateIdx = (b2 >> 2) & 0x03;
      if (
        versionBits === 1 ||
        layerBits !== 1 ||
        bitrateIdx === 0 ||
        bitrateIdx === 15 ||
        sampleRateIdx === 3
      ) {
        continue;
      }
      const kbps =
        (versionBits === 3 ? BITRATES_V1_L3.at(bitrateIdx) : BITRATES_V2_L3.at(bitrateIdx)) ?? 0;
      if (kbps > 0) {
        const audioBytes = Math.max(0, totalSizeBytes - offset);
        const sec = (audioBytes * 8) / (kbps * 1000);
        if (sec > 0.3 && sec < 7200) {
          return Math.round(sec * 10) / 10;
        }
      }
    }
  }
  return null;
};

const extractFilenameFromDisposition = (header: string | null): string | null => {
  if (!header) return null;
  const utf8Match = /filename\*=UTF-8''([^;\r\n]+)/i.exec(header);
  const rawMatch = /filename="?([^";\r\n]+)"?/i.exec(header);
  const encoded = utf8Match?.at(1) ?? rawMatch?.at(1);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded.trim())
      .replace(/\+/g, " ")
      .replace(/\.[^.]+$/, "");
  } catch {
    return encoded.trim().replace(/\.[^.]+$/, "");
  }
};

const extractTotalSize = (res: Response, fallbackLen: number): number => {
  const contentRange = res.headers.get("content-range") ?? "";
  const crMatch = /\/(\d+)$/.exec(contentRange);
  if (crMatch?.at(1)) {
    const parsed = Number.parseInt(crMatch.at(1) ?? "0", 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const cl = res.headers.get("content-length");
  if (cl) {
    const parsed = Number.parseInt(cl, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallbackLen;
};

const probeCache = new Map<string, ProbedDriveMedia>();

const probeDriveMedia = (fileId: DriveFileId, fallbackDuration: number, kind: "clip" | "voice") =>
  Effect.tryPromise({
    try: async () => {
      const cacheKey = `${kind}:${fileId}`;
      const cached = probeCache.get(cacheKey);
      if (cached) return cached;

      const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Range: kind === "voice" ? "bytes=0-32767" : "bytes=0-65535",
          "User-Agent": BROWSER_USER_AGENT,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(12_000),
      });

      const name =
        extractFilenameFromDisposition(res.headers.get("content-disposition")) ??
        `${kind === "voice" ? "Voice" : "Drive"}_${fileId.slice(0, 8)}`;

      let duration = fallbackDuration;
      let contentHash: Option.Option<ContentHash> = Option.none();
      if (res.ok || res.status === 206) {
        const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
        if (!contentType.includes("text/html")) {
          const headBytes = new Uint8Array(await res.arrayBuffer());
          const totalSize = extractTotalSize(res, headBytes.length);

          if (kind === "clip") {
            const digest = crypto
              .createHash("md5")
              .update(headBytes)
              .update(String(totalSize))
              .digest("hex")
              .slice(0, 16);
            contentHash = Option.some(digest as ContentHash);
          }

          let probed =
            kind === "voice"
              ? (parseMp3DurationFromBytes(headBytes, totalSize) ??
                parseMp4DurationFromBytes(headBytes))
              : parseMp4DurationFromBytes(headBytes);

          // If moov/mvhd is at the tail (common for iPhone/CapCut MP4/MOV), probe last 128 KB
          if ((probed === null || probed <= 0) && totalSize > 131072) {
            try {
              const tailStart = Math.max(0, totalSize - 131072);
              const tailRes = await fetch(url, {
                method: "GET",
                headers: {
                  Range: `bytes=${String(tailStart)}-${String(totalSize - 1)}`,
                  "User-Agent": BROWSER_USER_AGENT,
                },
                redirect: "follow",
                signal: AbortSignal.timeout(12_000),
              });
              if (tailRes.ok || tailRes.status === 206) {
                const tailBytes = new Uint8Array(await tailRes.arrayBuffer());
                probed = parseMp4DurationFromBytes(tailBytes);
              }
            } catch {
              // ignore tail probe failure
            }
          }

          const maxValid = kind === "voice" ? 7200 : 3600;
          if (probed !== null && probed > 0.1 && probed <= maxValid) {
            duration = probed;
          }
        }
      }

      const lockFlipH = kind === "clip" && name.toLowerCase().includes("_lock");

      const result: ProbedDriveMedia = {
        fileId,
        name,
        duration: duration as Seconds,
        streamUrl: `/api/drive-stream/${fileId}` as MediaUrl,
        lockFlipH,
        contentHash,
      };
      if (res.ok || res.status === 206) {
        probeCache.set(cacheKey, result);
      }
      return result;
    },
    catch: (err) =>
      new UpstreamError({
        service: "drive",
        message: `Không thể đọc metadata từ Google Drive (${String(err)})`,
      }),
  });

export const DriveMediaGatewayLive = Layer.succeed(DriveMediaGateway, {
  probeClip: (fileId) =>
    probeDriveMedia(fileId, 4, "clip").pipe(
      Effect.orElseSucceed(() => ({
        fileId,
        name: `Drive_${fileId.slice(0, 8)}`,
        duration: 4 as Seconds,
        streamUrl: `/api/drive-stream/${fileId}` as MediaUrl,
        lockFlipH: false,
        contentHash: Option.none(),
      })),
    ),
  probeVoice: (fileId) =>
    probeDriveMedia(fileId, 20, "voice").pipe(
      Effect.orElseSucceed(() => ({
        fileId,
        name: `Voice_${fileId.slice(0, 8)}`,
        duration: 20 as Seconds,
        streamUrl: `/api/drive-stream/${fileId}` as MediaUrl,
        lockFlipH: false,
        contentHash: Option.none(),
      })),
    ),
});
