"use client";

import { Option } from "effect";
import { CheckCircle2, Info, Search, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { SHOT_CATEGORY_VALUES, type ShotCategory } from "@/contexts/shared-kernel";
import { Button, IconButton, StatusChip, Text, TextInput } from "@/shared/ui";

import { extractGoogleDriveFileId } from "../domain/drive-parser";
import type { ClipLibrary, VoiceClip } from "../domain/types";

export interface DriveQuickCheckProps {
  readonly library: ClipLibrary;
  readonly voices?: ReadonlyArray<VoiceClip> | undefined;
  readonly activeFilter?: ShotCategory | "all" | undefined;
  readonly onFilterChange?: ((next: ShotCategory | "all") => void) | undefined;
  readonly onOpenHistory?: ((searchQuery: string) => void) | undefined;
}

const FILTER_LABELS: Readonly<Record<ShotCategory | "all", string>> = {
  all: "Tất cả",
  open: "Open",
  product: "Product",
  texture: "Texture",
  apply: "Apply",
  end: "End",
};

export function DriveQuickCheck({
  library,
  voices = [],
  activeFilter = "all",
  onFilterChange,
  onOpenHistory,
}: DriveQuickCheckProps) {
  const [quickCheckInput, setQuickCheckInput] = useState("");

  const matchResult = useMemo(() => {
    const trimmed = quickCheckInput.trim();
    if (!trimmed) return null;
    const maybeId = extractGoogleDriveFileId(trimmed);
    if (Option.isNone(maybeId)) {
      return { valid: false as const, fileId: null, matches: [] as ReadonlyArray<string> };
    }
    const fileId = maybeId.value;
    const matches: Array<string> = [];
    for (const cat of SHOT_CATEGORY_VALUES) {
      for (const clip of library[cat]) {
        if (clip.source._tag === "DriveClip" && clip.source.fileId === fileId) {
          matches.push(`${FILTER_LABELS[cat]}: ${clip.name}`);
        }
      }
    }
    for (const voice of voices) {
      if (voice.localUrl.includes(fileId)) {
        matches.push(`Voice: ${voice.name}`);
      }
    }
    return { valid: true as const, fileId, matches };
  }, [quickCheckInput, library, voices]);

  return (
    <div className="space-y-2.5 rounded-xl bg-[#070811] px-3 py-2">
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <TextInput
            value={quickCheckInput}
            onChange={(e) => {
              setQuickCheckInput(e.target.value);
            }}
            placeholder="Kiểm tra nhanh: Dán link Google Drive hoặc File ID vào đây để kiểm tra đã nạp chưa..."
            aria-label="Kiểm tra nhanh link Google Drive"
            className="w-full border-none bg-transparent pr-8 pl-9 font-mono text-xs text-zinc-200 shadow-none ring-0 placeholder:text-zinc-500 focus:border-none focus:ring-0"
          />
          {quickCheckInput ? (
            <IconButton
              aria-label="Xoá tìm kiếm nhanh"
              size="sm"
              variant="ghost"
              onPress={() => {
                setQuickCheckInput("");
              }}
              className="absolute right-1"
            >
              <X className="h-3.5 w-3.5 text-zinc-400" />
            </IconButton>
          ) : null}
        </div>

        {onFilterChange ? (
          <div className="flex flex-wrap items-center gap-1">
            {(["all", ...SHOT_CATEGORY_VALUES] as const).map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={activeFilter === cat ? "primary" : "secondary"}
                onPress={() => {
                  onFilterChange(cat);
                }}
              >
                {FILTER_LABELS[cat]}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {matchResult ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!matchResult.valid ? (
            <StatusChip color="warning" variant="soft" size="sm">
              <XCircle className="mr-1 inline h-3.5 w-3.5" />
              Không nhận diện được Google Drive File ID hợp lệ.
            </StatusChip>
          ) : matchResult.matches.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip color="success" variant="soft" size="sm">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />
                Đã có trong kho ({matchResult.matches.join(", ")})
              </StatusChip>
              {onOpenHistory ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => {
                    onOpenHistory(quickCheckInput);
                  }}
                  className="h-6 px-2 text-[11px] text-emerald-300 underline"
                >
                  Xem chi tiết
                </Button>
              ) : null}
            </div>
          ) : (
            <StatusChip color="default" variant="soft" size="sm">
              <Info className="mr-1 inline h-3.5 w-3.5 text-sky-400" />
              <Text variant="caption">
                Chưa có ID {matchResult.fileId} trong kho (hợp lệ để dán nạp).
              </Text>
            </StatusChip>
          )}
        </div>
      ) : null}
    </div>
  );
}
