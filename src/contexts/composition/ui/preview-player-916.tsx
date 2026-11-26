"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PlannedSlot, PlannedVideo } from "../domain/types";
import { PreviewPlayerFrame } from "./preview-player-frame";

const driveBlobCache = new Map<string, string>();

export interface PreviewPlayer916Props {
  readonly video: PlannedVideo;
  readonly voiceUrl?: string | null | undefined;
  readonly voiceDuration?: number | undefined;
  readonly enableVoice?: boolean | undefined;
  readonly previewMode?: "full" | "slot" | undefined;
  readonly isolatedSlotIndex?: number | null | undefined;
  readonly isScrubbing?: boolean | undefined;
  readonly scrubSourceSec?: number | null | undefined;
  readonly playTrigger?: number | undefined;
  readonly pauseTrigger?: number | undefined;
  readonly seekTimelineSec?: number | null | undefined;
  readonly onPlayingChange?: ((playing: boolean) => void) | undefined;
}

const getCachedMediaUrl = (slot?: PlannedSlot): string => {
  const raw = slot?.localUrl ?? "";
  return (raw && driveBlobCache.get(raw)) ?? raw;
};

const clampRate = (speed: number): number => Math.min(4, Math.max(0.25, speed || 1));

const ensureElementSrc = (el: HTMLMediaElement | null, mediaUrl: string): void => {
  if (!el || !mediaUrl) return;
  if (!el.src || (!el.src.endsWith(mediaUrl) && el.src !== mediaUrl)) {
    el.src = mediaUrl;
  }
};

const prepVideoSlot = (
  vid: HTMLVideoElement | null,
  slot: PlannedSlot | undefined,
  pauseAfter = false,
): void => {
  if (!vid || !slot) return;
  ensureElementSrc(vid, getCachedMediaUrl(slot));
  vid.currentTime = slot.videoBegin;
  vid.playbackRate = clampRate(slot.speed);
  if (pauseAfter) vid.pause();
};

const syncSlotAudioTime = (
  audioEl: HTMLAudioElement | null,
  isoSlot: PlannedSlot,
  sourceSec: number,
  enableVoice: boolean,
  rawVoiceUrl: string,
): number => {
  const progress = Math.max(
    0,
    Math.min(
      1,
      (sourceSec - isoSlot.videoBegin) / Math.max(0.001, isoSlot.videoEnd - isoSlot.videoBegin),
    ),
  );
  const targetAudio = isoSlot.enterBegin + progress * (isoSlot.exitEnd - isoSlot.enterBegin);
  if (audioEl && enableVoice && rawVoiceUrl) {
    audioEl.currentTime = targetAudio;
  }
  return targetAudio;
};

const findSlotIndexAtTime = (slots: ReadonlyArray<PlannedSlot>, sec: number): number => {
  for (let i = slots.length - 1; i >= 0; i--) {
    const s = slots.at(i);
    if (s && sec >= s.enterBegin && sec <= s.exitEnd + 0.05) {
      return i;
    }
  }
  return 0;
};

export function PreviewPlayer916({
  video,
  voiceUrl = null,
  voiceDuration,
  enableVoice = true,
  previewMode = "full",
  isolatedSlotIndex = null,
  isScrubbing = false,
  scrubSourceSec = null,
  playTrigger,
  pauseTrigger,
  seekTimelineSec = null,
  onPlayingChange,
}: PreviewPlayer916Props) {
  const videoRefA = useRef<HTMLVideoElement | null>(null);
  const videoRefB = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const preloadedSlotIndexRef = useRef<number | null>(null);

  const [isPlaying, setIsPlayingState] = useState(false);
  const [timelineSec, setTimelineSec] = useState(0);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [slotCurrentSec, setSlotCurrentSec] = useState(0);
  const [mutedVoice, setMutedVoice] = useState(false);
  const [isDraggingBar, setIsDraggingBar] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const timelineSecRef = useRef(0);
  const activeSlotIndexRef = useRef(0);
  const isPlayingRef = useRef(false);
  const isBufferingRef = useRef(false);
  const onPlayingChangeRef = useRef(onPlayingChange);

  const setBufferingSync = useCallback((nextBuffering: boolean) => {
    if (isBufferingRef.current !== nextBuffering) {
      isBufferingRef.current = nextBuffering;
      setIsBuffering(nextBuffering);
    }
  }, []);

  useEffect(() => {
    onPlayingChangeRef.current = onPlayingChange;
  }, [onPlayingChange]);

  const setPlayingSync = useCallback(
    (nextPlaying: boolean) => {
      isPlayingRef.current = nextPlaying;
      setIsPlayingState(nextPlaying);
      if (!nextPlaying) setBufferingSync(false);
      onPlayingChangeRef.current?.(nextPlaying);
    },
    [setBufferingSync],
  );

  const totalDuration = Math.max(0.5, video.finalDuration || 20);
  const rawVoiceUrl = voiceUrl ?? "";
  const effectiveVoiceDur = voiceDuration ?? totalDuration;

  const isSlotMode =
    previewMode === "slot" &&
    typeof isolatedSlotIndex === "number" &&
    isolatedSlotIndex >= 0 &&
    isolatedSlotIndex < video.slots.length;

  const isoSlot =
    isSlotMode && typeof isolatedSlotIndex === "number"
      ? (video.slots.at(isolatedSlotIndex) ?? null)
      : null;

  const currentSlot =
    isSlotMode && isoSlot ? isoSlot : (video.slots.at(activeSlotIndex) ?? video.slots[0]);

  const isVideoAActive = isSlotMode ? true : activeSlotIndex % 2 === 0;

  useEffect(() => {
    const controller = new AbortController();
    const cacheQueue = async () => {
      for (const slot of video.slots) {
        if (controller.signal.aborted) break;
        const url = slot.localUrl;
        if (url.startsWith("/api/drive-stream/") && !driveBlobCache.has(url)) {
          try {
            const res = await fetch(url, { signal: controller.signal });
            if (res.ok) {
              const blob = await res.blob();
              driveBlobCache.set(url, URL.createObjectURL(blob));
            }
          } catch {
            // ignore network error
          }
        }
      }
    };
    void cacheQueue();
    return () => {
      controller.abort();
    };
  }, [video.slots]);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (!enableVoice || !rawVoiceUrl) {
      audioEl.pause();
      audioEl.removeAttribute("src");
      return;
    }
    if ((audioEl.getAttribute("data-voice-url") ?? "") !== rawVoiceUrl) {
      audioEl.setAttribute("data-voice-url", rawVoiceUrl);
      audioEl.src = rawVoiceUrl;
      audioEl.currentTime = timelineSecRef.current;
    }
  }, [enableVoice, rawVoiceUrl]);

  const preloadNextSlot = useCallback(
    (currentIndex: number) => {
      if (isSlotMode) return;
      const nextIndex = currentIndex + 1;
      if (nextIndex >= video.slots.length || preloadedSlotIndexRef.current === nextIndex) {
        return;
      }
      const nextSlot = video.slots.at(nextIndex);
      const targetVid = nextIndex % 2 === 0 ? videoRefA.current : videoRefB.current;
      if (!targetVid || !nextSlot) return;
      prepVideoSlot(targetVid, nextSlot, true);
      preloadedSlotIndexRef.current = nextIndex;
    },
    [isSlotMode, video.slots],
  );

  const handleSeekTimeline = useCallback(
    (targetSec: number, forcePlay?: boolean) => {
      const shouldPlay = forcePlay ?? isPlayingRef.current;
      const clamped = Math.max(0, Math.min(totalDuration, targetSec));
      timelineSecRef.current = clamped;
      setTimelineSec(clamped);

      const targetIndex = findSlotIndexAtTime(video.slots, clamped);
      activeSlotIndexRef.current = targetIndex;
      setActiveSlotIndex(targetIndex);

      const slot = video.slots.at(targetIndex);
      if (!slot) return;
      const elapsed = Math.max(0, clamped - slot.enterBegin);
      const targetSourceTime = Math.min(
        slot.videoEnd,
        slot.videoBegin + elapsed * (slot.speed || 1),
      );
      const isA = targetIndex % 2 === 0;
      const targetVid = isA ? videoRefA.current : videoRefB.current;
      const idleVid = isA ? videoRefB.current : videoRefA.current;
      idleVid?.pause();

      if (targetVid) {
        ensureElementSrc(targetVid, getCachedMediaUrl(slot));
        targetVid.currentTime = targetSourceTime;
        targetVid.playbackRate = clampRate(slot.speed);
      }

      const audioEl = audioRef.current;
      if (audioEl && enableVoice && rawVoiceUrl) {
        if ((audioEl.getAttribute("data-voice-url") ?? "") !== rawVoiceUrl) {
          audioEl.setAttribute("data-voice-url", rawVoiceUrl);
          audioEl.src = rawVoiceUrl;
        }
        const audioDur = effectiveVoiceDur || audioEl.duration || totalDuration;
        if (clamped < audioDur) audioEl.currentTime = clamped;
        else audioEl.pause();
      }

      if (shouldPlay) {
        setBufferingSync(true);
      } else {
        targetVid?.pause();
        audioEl?.pause();
        setBufferingSync(false);
      }
      preloadedSlotIndexRef.current = null;
      preloadNextSlot(targetIndex);
    },
    [
      effectiveVoiceDur,
      enableVoice,
      preloadNextSlot,
      rawVoiceUrl,
      setBufferingSync,
      totalDuration,
      video.slots,
    ],
  );

  const handleSeekRef = useRef(handleSeekTimeline);
  useEffect(() => {
    handleSeekRef.current = handleSeekTimeline;
  }, [handleSeekTimeline]);

  const prevVideoIdRef = useRef(video.id);
  useEffect(() => {
    const isChanged = prevVideoIdRef.current !== video.id;
    prevVideoIdRef.current = video.id;
    preloadedSlotIndexRef.current = null;
    timelineSecRef.current = 0;
    activeSlotIndexRef.current = 0;
    if (isChanged) {
      const timer = setTimeout(() => {
        setPlayingSync(false);
        setTimelineSec(0);
        setActiveSlotIndex(0);
      }, 0);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [video.id, setPlayingSync]);

  useEffect(() => {
    if (isPlayingRef.current) return;
    if (isSlotMode && isoSlot) {
      prepVideoSlot(videoRefA.current, isoSlot, true);
      videoRefB.current?.pause();
      audioRef.current?.pause();
      return;
    }
    prepVideoSlot(videoRefA.current, video.slots[0], true);
    const slot1 = video.slots.at(1);
    if (slot1) {
      prepVideoSlot(videoRefB.current, slot1, true);
      preloadedSlotIndexRef.current = 1;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [video, isSlotMode, isoSlot]);

  const lastPlayTriggerRef = useRef<number>(0);
  useEffect(() => {
    if (
      playTrigger !== undefined &&
      playTrigger > 0 &&
      playTrigger !== lastPlayTriggerRef.current
    ) {
      lastPlayTriggerRef.current = playTrigger;
      const timer = setTimeout(() => {
        setPlayingSync(true);
        if (isSlotMode && isoSlot) {
          prepVideoSlot(videoRefA.current, isoSlot);
          setBufferingSync(true);
          if (audioRef.current && enableVoice && rawVoiceUrl) {
            audioRef.current.currentTime = isoSlot.enterBegin;
          } else {
            audioRef.current?.pause();
          }
        } else {
          const startPos =
            timelineSecRef.current >= totalDuration - 0.15 ? 0 : timelineSecRef.current;
          handleSeekRef.current(startPos, true);
        }
      }, 0);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [
    playTrigger,
    isSlotMode,
    isoSlot,
    enableVoice,
    rawVoiceUrl,
    setPlayingSync,
    setBufferingSync,
    totalDuration,
  ]);

  const lastPauseTriggerRef = useRef<number>(0);
  useEffect(() => {
    if (
      pauseTrigger !== undefined &&
      pauseTrigger > 0 &&
      pauseTrigger !== lastPauseTriggerRef.current
    ) {
      lastPauseTriggerRef.current = pauseTrigger;
      const timer = setTimeout(() => {
        setPlayingSync(false);
        videoRefA.current?.pause();
        videoRefB.current?.pause();
        audioRef.current?.pause();
      }, 0);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [pauseTrigger, setPlayingSync]);

  useEffect(() => {
    if (
      isSlotMode &&
      isScrubbing &&
      typeof scrubSourceSec === "number" &&
      !Number.isNaN(scrubSourceSec)
    ) {
      if (videoRefA.current) {
        videoRefA.current.pause();
        videoRefA.current.currentTime = scrubSourceSec;
      }
      if (isoSlot) {
        audioRef.current?.pause();
        syncSlotAudioTime(audioRef.current, isoSlot, scrubSourceSec, enableVoice, rawVoiceUrl);
      }
      const timer = setTimeout(() => {
        setSlotCurrentSec(scrubSourceSec);
      }, 0);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [isSlotMode, isScrubbing, scrubSourceSec, enableVoice, rawVoiceUrl, isoSlot]);

  useEffect(() => {
    if (!isSlotMode && typeof seekTimelineSec === "number" && !Number.isNaN(seekTimelineSec)) {
      const timer = setTimeout(() => {
        handleSeekRef.current(seekTimelineSec);
      }, 0);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [seekTimelineSec, isSlotMode]);

  useEffect(() => {
    if (!isPlaying || (isSlotMode && isScrubbing) || isDraggingBar) {
      videoRefA.current?.pause();
      videoRefB.current?.pause();
      audioRef.current?.pause();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
      return;
    }

    if (isSlotMode && isoSlot) {
      const vidA = videoRefA.current;
      if (vidA) {
        ensureElementSrc(vidA, getCachedMediaUrl(isoSlot));
        vidA.playbackRate = clampRate(isoSlot.speed);
        if (
          vidA.currentTime < isoSlot.videoBegin - 0.05 ||
          vidA.currentTime >= isoSlot.videoEnd - 0.05
        ) {
          vidA.currentTime = isoSlot.videoBegin;
        }
      }
      videoRefB.current?.pause();
      const audioEl = audioRef.current;
      if (audioEl && enableVoice && rawVoiceUrl) {
        if ((audioEl.getAttribute("data-voice-url") ?? "") !== rawVoiceUrl) {
          audioEl.setAttribute("data-voice-url", rawVoiceUrl);
          audioEl.src = rawVoiceUrl;
        }
        syncSlotAudioTime(
          audioEl,
          isoSlot,
          vidA ? vidA.currentTime : isoSlot.videoBegin,
          enableVoice,
          rawVoiceUrl,
        );
      } else {
        audioEl?.pause();
      }

      const tickSlot = () => {
        if (!isPlayingRef.current) return;
        if (vidA) {
          if (vidA.seeking || vidA.readyState < 2) {
            setBufferingSync(true);
            if (!vidA.paused) vidA.pause();
            if (audioEl && !audioEl.paused) audioEl.pause();
            rafRef.current = requestAnimationFrame(tickSlot);
            return;
          }
          setBufferingSync(false);
          if (vidA.paused) void vidA.play().catch(() => {});
          const curTime = vidA.currentTime;
          setSlotCurrentSec(curTime);
          if (audioEl && enableVoice && rawVoiceUrl) {
            const targetAudio = syncSlotAudioTime(null, isoSlot, curTime, enableVoice, rawVoiceUrl);
            if (audioEl.paused) void audioEl.play().catch(() => {});
            if (Math.abs(audioEl.currentTime - targetAudio) > 0.25) {
              audioEl.currentTime = targetAudio;
            }
          }
          if (curTime >= isoSlot.videoEnd - 0.05 || curTime < isoSlot.videoBegin - 0.05) {
            vidA.currentTime = isoSlot.videoBegin;
            if (audioEl && enableVoice && rawVoiceUrl) {
              audioEl.currentTime = isoSlot.enterBegin;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tickSlot);
      };

      rafRef.current = requestAnimationFrame(tickSlot);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    const currentSlotIdx = activeSlotIndexRef.current;
    const currentVid = currentSlotIdx % 2 === 0 ? videoRefA.current : videoRefB.current;
    const slot = video.slots.at(currentSlotIdx);
    if (currentVid && slot) {
      ensureElementSrc(currentVid, getCachedMediaUrl(slot));
      currentVid.playbackRate = clampRate(slot.speed);
    }

    const audioEl = audioRef.current;
    if (audioEl && enableVoice && rawVoiceUrl) {
      if ((audioEl.getAttribute("data-voice-url") ?? "") !== rawVoiceUrl) {
        audioEl.setAttribute("data-voice-url", rawVoiceUrl);
        audioEl.src = rawVoiceUrl;
      }
      const audioDur = effectiveVoiceDur || audioEl.duration || totalDuration;
      if (timelineSecRef.current < audioDur) {
        if (Math.abs(audioEl.currentTime - timelineSecRef.current) > 0.25) {
          audioEl.currentTime = timelineSecRef.current;
        }
      } else {
        audioEl.pause();
      }
    }

    const tick = (now: number) => {
      if (!isPlayingRef.current) return;
      const activeIdx = activeSlotIndexRef.current;
      const activeVid = activeIdx % 2 === 0 ? videoRefA.current : videoRefB.current;
      const aud = audioRef.current;
      const isVoiceActive = enableVoice && Boolean(rawVoiceUrl) && !isSlotMode;
      const audioDur = isVoiceActive ? effectiveVoiceDur || aud?.duration || totalDuration : 0;
      const isVoiceNeededNow = isVoiceActive && timelineSecRef.current < audioDur;

      const isVidBuffering = Boolean(activeVid && (activeVid.seeking || activeVid.readyState < 2));
      const isAudioBuffering = Boolean(
        isVoiceNeededNow && aud && (aud.seeking || aud.readyState < 2),
      );
      if (isVidBuffering || isAudioBuffering) {
        setBufferingSync(true);
        if (activeVid && !activeVid.paused) activeVid.pause();
        if (aud && !aud.paused) aud.pause();
        lastTickRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      setBufferingSync(false);
      if (activeVid && activeVid.paused) void activeVid.play().catch(() => {});
      if (isVoiceNeededNow && aud && aud.paused) {
        void aud.play().catch(() => {});
      }

      if (lastTickRef.current == null) lastTickRef.current = now;
      const delta = Math.min(0.1, (now - lastTickRef.current) / 1000);
      lastTickRef.current = now;

      const nextSec = timelineSecRef.current + delta;
      if (nextSec >= totalDuration) {
        timelineSecRef.current = 0;
        activeSlotIndexRef.current = 0;
        setTimelineSec(0);
        setActiveSlotIndex(0);
        prepVideoSlot(videoRefA.current, video.slots[0]);
        const slot1 = video.slots.at(1);
        if (slot1) {
          prepVideoSlot(videoRefB.current, slot1, true);
          preloadedSlotIndexRef.current = 1;
        }
        if (aud && enableVoice && rawVoiceUrl) aud.currentTime = 0;
        setBufferingSync(true);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      timelineSecRef.current = nextSec;
      setTimelineSec(nextSec);

      const newSlotIdx = findSlotIndexAtTime(video.slots, nextSec);
      if (newSlotIdx !== activeSlotIndexRef.current) {
        activeSlotIndexRef.current = newSlotIdx;
        setActiveSlotIndex(newSlotIdx);
        const newIsA = newSlotIdx % 2 === 0;
        const nowActiveVid = newIsA ? videoRefA.current : videoRefB.current;
        const nowIdleVid = newIsA ? videoRefB.current : videoRefA.current;
        const newSlot = video.slots.at(newSlotIdx);
        if (nowActiveVid && newSlot) {
          ensureElementSrc(nowActiveVid, getCachedMediaUrl(newSlot));
          nowActiveVid.playbackRate = clampRate(newSlot.speed);
        }
        nowIdleVid?.pause();
        preloadNextSlot(newSlotIdx);
      }

      if (isVoiceNeededNow && aud && !aud.paused) {
        if (Math.abs(aud.currentTime - nextSec) > 0.35) {
          aud.currentTime = nextSec;
        }
      } else if (aud && !isVoiceNeededNow && !aud.paused) {
        aud.pause();
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [
    isPlaying,
    isSlotMode,
    isScrubbing,
    isDraggingBar,
    isoSlot,
    totalDuration,
    enableVoice,
    video.slots,
    rawVoiceUrl,
    effectiveVoiceDur,
    preloadNextSlot,
    setBufferingSync,
  ]);

  return (
    <PreviewPlayerFrame
      videoRefA={videoRefA}
      videoRefB={videoRefB}
      audioRef={audioRef}
      slots={video.slots}
      currentSlot={currentSlot}
      isoSlot={isoSlot}
      isSlotMode={isSlotMode}
      isVideoAActive={isVideoAActive}
      isPlaying={isPlaying}
      isBuffering={isBuffering}
      isDraggingBar={isDraggingBar}
      activeSlotIndex={activeSlotIndex}
      timelineSec={timelineSec}
      slotCurrentSec={slotCurrentSec}
      totalDuration={totalDuration}
      enableVoice={enableVoice}
      hasVoiceTrack={Boolean(rawVoiceUrl)}
      mutedVoice={mutedVoice}
      onTogglePlay={() => {
        if (isPlaying) {
          setPlayingSync(false);
        } else {
          setPlayingSync(true);
          if (isSlotMode && isoSlot) setBufferingSync(true);
          else {
            const startPos =
              timelineSecRef.current >= totalDuration - 0.15 ? 0 : timelineSecRef.current;
            handleSeekTimeline(startPos, true);
          }
        }
      }}
      onRestart={() => {
        if (isSlotMode && isoSlot && videoRefA.current) {
          videoRefA.current.currentTime = isoSlot.videoBegin;
          setSlotCurrentSec(isoSlot.videoBegin);
          setPlayingSync(true);
          setBufferingSync(true);
        } else {
          setPlayingSync(true);
          handleSeekTimeline(0, true);
        }
      }}
      onToggleMuteVoice={() => {
        setMutedVoice((m) => !m);
      }}
      onDraggingBarChange={setIsDraggingBar}
      onBarSeek={(sec) => {
        if (isSlotMode && isoSlot) {
          setSlotCurrentSec(sec);
          if (videoRefA.current) videoRefA.current.currentTime = sec;
          syncSlotAudioTime(audioRef.current, isoSlot, sec, enableVoice, rawVoiceUrl);
        } else {
          handleSeekTimeline(sec);
        }
      }}
    />
  );
}
