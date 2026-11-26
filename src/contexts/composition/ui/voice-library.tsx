"use client";

import { Cloud, Copy, ExternalLink, Link2, Mic, Pause, Play, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

import type { VoiceId } from "@/contexts/shared-kernel";
import {
  Button,
  EmptyState,
  IconButton,
  Modal,
  StatusChip,
  SurfaceBox,
  Text,
  TextAreaField,
} from "@/shared/ui";

import { extractGoogleDriveFileId } from "../domain/drive-parser";
import type { VoiceClip } from "../domain/types";

export interface VoiceLibraryProps {
  readonly voices: ReadonlyArray<VoiceClip>;
  readonly canEdit: boolean;
  readonly isUploading?: boolean | undefined;
  readonly voiceMode?: "rotate" | "none" | undefined;
  readonly onVoiceModeChange?: ((mode: "rotate" | "none") => void) | undefined;
  readonly onIngestVoices: (urls: ReadonlyArray<string>) => Promise<void>;
  readonly onUploadVoices?: ((files: FileList) => Promise<void>) | undefined;
  readonly onRemoveVoice: (voiceId: VoiceId) => Promise<void>;
  readonly onCopyLink?: ((url: string) => void) | undefined;
}

export function VoiceLibrary({
  voices,
  canEdit,
  isUploading = false,
  voiceMode = "rotate",
  onVoiceModeChange,
  onIngestVoices,
  onUploadVoices,
  onRemoveVoice,
  onCopyLink,
}: VoiceLibraryProps) {
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveLinksText, setDriveLinksText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditionVoiceId, setAuditionVoiceId] = useState<VoiceId | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAddDriveVoices = async () => {
    const lines = driveLinksText
      .split(/[\n,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (lines.length === 0) return;
    setIsSubmitting(true);
    await onIngestVoices(lines);
    setDriveLinksText("");
    setIsSubmitting(false);
    setIsDriveModalOpen(false);
  };

  const toggleAudition = (voice: VoiceClip) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (auditionVoiceId === voice.id) {
      audio.pause();
      setAuditionVoiceId(null);
      return;
    }
    audio.src = voice.localUrl;
    audio.currentTime = 0;
    void audio.play();
    setAuditionVoiceId(voice.id);
  };

  return (
    <SurfaceBox className="flex min-h-[240px] flex-col justify-between gap-2.5 border-zinc-800 bg-[#070811] p-3.5">
      <audio
        ref={audioRef}
        onEnded={() => {
          setAuditionVoiceId(null);
        }}
        className="hidden"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && onUploadVoices) {
            void onUploadVoices(e.target.files);
          }
          e.target.value = "";
        }}
      />

      <div className="space-y-2 border-b border-zinc-800/80 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <StatusChip color="accent" variant="soft" size="sm">
              Voice
            </StatusChip>
            <StatusChip color="default" variant="soft" size="sm">
              {voices.length} voice
            </StatusChip>
          </div>

          {canEdit ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                onPress={() => {
                  setIsDriveModalOpen(true);
                }}
                className="h-6 rounded-md px-2 text-[10px]"
              >
                <Link2 className="h-3 w-3 text-sky-400" />
                Link Drive
              </Button>
              {onUploadVoices ? (
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={isUploading}
                  onPress={() => {
                    fileInputRef.current?.click();
                  }}
                  className="h-6 rounded-md px-2 text-[10px]"
                >
                  <Plus className="h-3 w-3" />
                  File
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Text variant="caption" className="text-[11px] text-zinc-400">
            Chế độ lồng tiếng:
          </Text>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={voiceMode === "none" ? "primary" : "ghost"}
              onPress={() => {
                onVoiceModeChange?.("none");
              }}
              className="h-6 rounded-md px-2 text-[10px]"
            >
              Không lồng
            </Button>
            <Button
              size="sm"
              variant={voiceMode === "rotate" ? "primary" : "ghost"}
              onPress={() => {
                onVoiceModeChange?.("rotate");
              }}
              className="h-6 rounded-md px-2 text-[10px]"
            >
              Xoay vòng
            </Button>
          </div>
        </div>
      </div>

      {voices.length === 0 ? (
        <EmptyState
          icon={<Mic className="h-5 w-5" />}
          title="Chưa có file voice"
          description="Thêm link Drive hoặc tải file âm thanh."
        />
      ) : (
        <ul className="max-h-56 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {voices.map((voice) => {
            const isAuditioning = auditionVoiceId === voice.id;
            const maybeDrive = extractGoogleDriveFileId(voice.localUrl);
            const driveUrl =
              maybeDrive._tag === "Some"
                ? `https://drive.google.com/file/d/${maybeDrive.value}/view`
                : null;

            return (
              <li
                key={voice.id}
                className="space-y-1 rounded-lg border border-zinc-800/90 bg-[#0b0d18] p-2 text-xs"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <IconButton
                      size="sm"
                      variant={isAuditioning ? "primary" : "ghost"}
                      aria-label={
                        isAuditioning ? `Dừng nghe ${voice.name}` : `Nghe thử ${voice.name}`
                      }
                      onPress={() => {
                        toggleAudition(voice);
                      }}
                      className="h-6 w-6"
                    >
                      {isAuditioning ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3 text-emerald-400" />
                      )}
                    </IconButton>
                    {driveUrl ? <Cloud className="h-3 w-3 shrink-0 text-sky-400" /> : null}
                    <Text
                      variant="label"
                      className="truncate text-[11px] font-medium text-zinc-200"
                    >
                      {voice.name}
                    </Text>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Text variant="mono" className="text-[10px] text-zinc-400">
                      {voice.duration.toFixed(1)}s
                    </Text>
                    {canEdit ? (
                      <IconButton
                        size="sm"
                        variant="ghost"
                        aria-label={`Xoá voice ${voice.name}`}
                        onPress={() => {
                          if (isAuditioning) {
                            audioRef.current?.pause();
                            setAuditionVoiceId(null);
                          }
                          void onRemoveVoice(voice.id);
                        }}
                        className="h-6 w-6"
                      >
                        <Trash2 className="h-3 w-3 text-zinc-500 hover:text-rose-400" />
                      </IconButton>
                    ) : null}
                  </div>
                </div>

                {driveUrl ? (
                  <div className="flex items-center justify-between gap-1.5 rounded border border-zinc-800/70 bg-[#070811] px-1.5 py-0.5 font-mono text-[9px]">
                    <a
                      href={driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-[180px] items-center gap-1 truncate text-sky-400 hover:underline"
                    >
                      <span className="truncate">{driveUrl}</span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                    </a>
                    <IconButton
                      size="sm"
                      variant="ghost"
                      aria-label={`Sao chép link voice ${voice.name}`}
                      onPress={() => {
                        void navigator.clipboard.writeText(driveUrl);
                        onCopyLink?.(driveUrl);
                      }}
                      className="h-5 w-5"
                    >
                      <Copy className="h-2.5 w-2.5 text-zinc-400" />
                    </IconButton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={isDriveModalOpen}
        onOpenChange={setIsDriveModalOpen}
        title="Thêm link Google Drive Voice"
        description="Mỗi dòng một liên kết file âm thanh (.mp3/.wav) trên Google Drive."
      >
        <div className="space-y-4">
          <TextAreaField
            ariaLabel="Link Google Drive file voice"
            rows={4}
            value={driveLinksText}
            onValueChange={setDriveLinksText}
            placeholder="Dán link Google Drive file voice (.mp3/.wav)..."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onPress={() => {
                setIsDriveModalOpen(false);
              }}
            >
              Huỷ
            </Button>
            <Button
              variant="primary"
              isLoading={isSubmitting}
              isDisabled={!driveLinksText.trim()}
              onPress={() => {
                void handleAddDriveVoices();
              }}
            >
              Thêm voice
            </Button>
          </div>
        </div>
      </Modal>
    </SurfaceBox>
  );
}
