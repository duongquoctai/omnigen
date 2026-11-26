"use client";
import JSZip from "jszip";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  Code2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Film,
  FlipHorizontal,
  FolderDown,
  FolderOpen,
  FolderSync,
  History,
  Info,
  Layers,
  Link2,
  Loader2,
  Lock,
  Menu,
  Mic,
  Music,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Scissors,
  Search,
  Share2,
  ShieldAlert,
  Shuffle,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Unlock,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import GlobalSidebar from "@/components/GlobalSidebar";
import IPhoneVideoTrimmer from "@/components/IPhoneVideoTrimmer";
import { PermissionGate, ProjectAccessProvider } from "@/components/PermissionGate";
import PreviewPlayer916 from "@/components/PreviewPlayer916";
import ShareProjectModal from "@/components/ShareProjectModal";
import UserAvatarMenu from "@/components/UserAvatarMenu";
import { extractGoogleDriveFileId, parseExcelFiveColumnClipboard } from "@/lib/drive";
import { CATEGORY_ORDER, recalculateComposedVideo } from "@/lib/planner";
import {
  CategoryMinDurations,
  CategoryPools,
  ComposedVideo,
  computeShotSpeedForMinDuration,
  DEFAULT_CATEGORY_MIN_DURATIONS,
  MultiVoiceItem,
  ProjectAccessInfo,
  ProjectState,
  RenderedVideoRecord,
  ResolvedShotSlot,
  Shot,
  SHOT_CATEGORIES,
  ShotCategory,
  ShotEdits,
  VoiceTrack,
} from "@/types/lachvid";

const VALID_TABS = ["split", "mix", "history"] as const;
type WorkspaceTab = (typeof VALID_TABS)[number];

const generateUploadId = (prefix = "upl") => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

interface StudioWorkspaceProps {
  projectId: string;
  projectName?: string;
  parentProjectId?: string;
  initialTab?: string;
  access?: ProjectAccessInfo;
}

const createDefaultState = (): ProjectState => ({
  sourceVideo: null,
  categoryMinDurations: { ...DEFAULT_CATEGORY_MIN_DURATIONS },
  shots: [],
  voiceTrack: null,
  categoryPools: {
    open: [],
    product: [],
    texture: [],
    apply: [],
    end: [],
  },
  multiVoiceTracks: [],
  syncMode: "video_master",
  diversityConfig: {
    targetCount: 10,
    targetOutputDuration: 20,
    minHammingDistance: 2,
    maxShotFrequency: 5,
    enableAutoVariantEdits: false,
    randomTransitionDuration: 0,
    seed: 42,
  },
  composedVideos: [],
  zvidPlanLimits: null,
  zvidUploadUsage: null,
});

export default function StudioWorkspace({
  projectId,
  projectName,
  parentProjectId,
  initialTab,
  access,
}: StudioWorkspaceProps) {
  const [accessState, setAccessState] = useState<ProjectAccessInfo | null>(access || null);

  const isOwner = Boolean(accessState?.isOwner);

  const canViewSplit = isOwner || !accessState || Boolean(accessState.permissions.split?.enabled);
  const canEditSplit =
    isOwner || !accessState || Boolean(accessState.permissions.split?.actions?.includes("edit"));
  const canExportSplit =
    isOwner || !accessState || Boolean(accessState.permissions.split?.actions?.includes("export"));

  const canViewMix = isOwner || !accessState || Boolean(accessState.permissions.mix?.enabled);
  const canEditMix =
    isOwner || !accessState || Boolean(accessState.permissions.mix?.actions?.includes("edit"));
  const canExportMix =
    isOwner || !accessState || Boolean(accessState.permissions.mix?.actions?.includes("export"));

  const canViewHistory =
    isOwner || !accessState || Boolean(accessState.permissions.history?.enabled);
  const canEditHistory =
    isOwner || !accessState || Boolean(accessState.permissions.history?.actions?.includes("edit"));
  const canExportHistory =
    isOwner ||
    !accessState ||
    Boolean(accessState.permissions.history?.actions?.includes("export"));

  const [currentProjectName, setCurrentProjectName] = useState<string>(projectName || "");
  const [parentProjectIdState, setParentProjectIdState] = useState<string>(parentProjectId || "");
  const [parentProjectNameState, setParentProjectNameState] = useState<string>("");
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [siblingFolders, setSiblingFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [showFolderSwitcher, setShowFolderSwitcher] = useState<boolean>(false);
  const folderSwitcherRef = useRef<HTMLDivElement | null>(null);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return window.localStorage.getItem("omnigen_sidebar_expanded") === "true";
      } catch {
        return false;
      }
    }
    return false;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("omnigen_sidebar_expanded", String(next));
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!showFolderSwitcher) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (folderSwitcherRef.current && !folderSwitcherRef.current.contains(e.target as Node)) {
        setShowFolderSwitcher(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [showFolderSwitcher]);

  const [projectRenderedCount, setProjectRenderedCount] = useState<number>(0);
  const [renderedHistoryList, setRenderedHistoryList] = useState<RenderedVideoRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [mainTab, setMainTabState] = useState<WorkspaceTab>(() => {
    if (initialTab && (VALID_TABS as readonly string[]).includes(initialTab)) {
      return initialTab as WorkspaceTab;
    }
    if (typeof window !== "undefined") {
      const paramTab = new URLSearchParams(window.location.search).get("tab");
      if (paramTab && (VALID_TABS as readonly string[]).includes(paramTab)) {
        return paramTab as WorkspaceTab;
      }
    }
    return "split";
  });

  const setMainTab = useCallback((newTab: WorkspaceTab) => {
    setMainTabState(newTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tab") !== newTab) {
        url.searchParams.set("tab", newTab);
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const paramTab = new URLSearchParams(window.location.search).get("tab");
      if (paramTab && (VALID_TABS as readonly string[]).includes(paramTab)) {
        setMainTabState(paramTab as WorkspaceTab);
      } else {
        setMainTabState("split");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Tự động chuyển tab nếu tab hiện tại không được cấp quyền view
  useEffect(() => {
    if (!accessState) return;
    const isCurrentAllowed =
      (mainTab === "split" && canViewSplit) ||
      (mainTab === "mix" && canViewMix) ||
      (mainTab === "history" && canViewHistory);

    if (!isCurrentAllowed) {
      const timer = setTimeout(() => {
        if (canViewMix) setMainTab("mix");
        else if (canViewHistory) setMainTab("history");
        else if (canViewSplit) setMainTab("split");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [accessState, mainTab, canViewSplit, canViewMix, canViewHistory, setMainTab]);
  const [historyFilterStatus, setHistoryFilterStatus] = useState<"all" | "unused" | "used">("all");
  const [historySearchText, setHistorySearchText] = useState<string>("");
  const [historySortOrder, setHistorySortOrder] = useState<"desc" | "asc">("desc");
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(10);
  const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<RenderedVideoRecord | null>(
    null,
  );
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const [state, setState] = useState<ProjectState>(() => createDefaultState());

  // Tab 1 (Split) states
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const slicerVideoRef = useRef<HTMLVideoElement | null>(null);
  const [slicerTime, setSlicerTime] = useState<number>(0);
  const [isPlayingSlicer, setIsPlayingSlicer] = useState<boolean>(false);
  const [playingShotOnly, setPlayingShotOnly] = useState<boolean>(false);
  const [pyThreshold, setPyThreshold] = useState<number>(27.0);
  const [pyMinSceneLen, setPyMinSceneLen] = useState<number>(0.8);
  const [pyDetector, setPyDetector] = useState<"content" | "adaptive">("content");
  const [isSlicing, setIsSlicing] = useState<boolean>(false);
  const [sourceBlobUrl, setSourceBlobUrl] = useState<string | null>(null);

  // Client-side session ID management (stored in localStorage)
  const [sessionId, setSessionId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      let sid = localStorage.getItem("lachvid_session_id");
      if (!sid) {
        sid = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem("lachvid_session_id", sid);
      }
      return sid;
    }
    return "default_session";
  });
  const [splitEditingCategory, setSplitEditingCategory] = useState<ShotCategory | null>("open");
  const [accordionShotId, setAccordionShotId] = useState<string | null>(null);

  // Tab 2 (Mixer) states
  const [categoryPools, setCategoryPools] = useState<CategoryPools>({
    open: [],
    product: [],
    texture: [],
    apply: [],
    end: [],
  });
  const [multiVoices, setMultiVoices] = useState<MultiVoiceItem[]>([]);
  const [selectedComposedId, setSelectedComposedId] = useState<string | null>(null);
  const [targetMixDuration, setTargetMixDuration] = useState<number>(20);
  const [targetMixCount, setTargetMixCount] = useState<number>(10);
  const [mixVoiceMode, setMixVoiceMode] = useState<"none" | "rotate">("rotate");
  const [clipNamePrefix, setClipNamePrefix] = useState<string>(projectName || "");
  const [editingSlotCategory, setEditingSlotCategory] = useState<ShotCategory | null>(null);
  const [activeSlotFocusIndex, setActiveSlotFocusIndex] = useState<number | null>(null);
  const [previewSeekSec, setPreviewSeekSec] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<"full" | "slot">("full");
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubSourceSec, setScrubSourceSec] = useState<number | null>(null);
  const [playTrigger, setPlayTrigger] = useState<number>(0);
  const [pauseTrigger, setPauseTrigger] = useState<number>(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<{
    current: number;
    total: number;
    name: string;
    percent: number;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    loadedBytes: number;
    totalBytes: number;
    percent: number;
    fileName?: string;
  } | null>(null);
  const [isRenderingBatch, setIsRenderingBatch] = useState<boolean>(false);

  // Google Drive Ingest states
  const [excelPasteText, setExcelPasteText] = useState<string>("");
  const [isIngestingDrive, setIsIngestingDrive] = useState<boolean>(false);
  const [singleCategoryDriveModal, setSingleCategoryDriveModal] = useState<{
    category: ShotCategory | "voice";
    text: string;
  } | null>(null);
  const [showSecondaryUploadMode, setShowSecondaryUploadMode] = useState<boolean>(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);
  const [showClearHistoryConfirmModal, setShowClearHistoryConfirmModal] = useState<boolean>(false);
  const [isClearingHistory, setIsClearingHistory] = useState<boolean>(false);
  const [showMarkAllRenderedModal, setShowMarkAllRenderedModal] = useState<boolean>(false);
  const [isMarkingAllRendered, setIsMarkingAllRendered] = useState<boolean>(false);
  const [historyItemPendingDelete, setHistoryItemPendingDelete] =
    useState<RenderedVideoRecord | null>(null);
  const [isDeletingHistoryItem, setIsDeletingHistoryItem] = useState<boolean>(false);

  // Google Drive History & Search states
  const [showDriveHistoryDrawer, setShowDriveHistoryDrawer] = useState<boolean>(false);
  const [driveHistorySearchText, setDriveHistorySearchText] = useState<string>("");
  const [driveHistoryCategoryFilter, setDriveHistoryCategoryFilter] = useState<
    "all" | ShotCategory | "voice"
  >("all");
  const [quickCheckInput, setQuickCheckInput] = useState<string>("");

  // Audition voice state
  const [auditionVoiceId, setAuditionVoiceId] = useState<string | null>(null);
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);

  const parsedExcel = useMemo(() => {
    return parseExcelFiveColumnClipboard(excelPasteText);
  }, [excelPasteText]);

  const allDriveLinks = useMemo(() => {
    const list: Array<{
      id: string;
      category: ShotCategory | "voice";
      name: string;
      fileName: string;
      fileId: string;
      driveUrl: string;
      duration: number;
      sizeBytes?: number;
    }> = [];

    CATEGORY_ORDER.forEach((cat) => {
      (categoryPools[cat] || []).forEach((it) => {
        if (it.driveFileId || it.sourceType === "drive") {
          const fileId = it.driveFileId || extractGoogleDriveFileId(it.localUrl) || "";
          list.push({
            id: it.id,
            category: cat,
            name: it.name,
            fileName: it.fileName,
            fileId,
            driveUrl: fileId ? `https://drive.google.com/file/d/${fileId}/view` : it.localUrl,
            duration: it.duration,
            sizeBytes: it.sizeBytes,
          });
        }
      });
    });

    (multiVoices || []).forEach((v) => {
      if (v.driveFileId || v.sourceType === "drive") {
        const fileId = v.driveFileId || extractGoogleDriveFileId(v.driveRawUrl || "") || "";
        list.push({
          id: v.id,
          category: "voice",
          name: v.name,
          fileName: v.fileName,
          fileId,
          driveUrl:
            v.driveRawUrl ||
            (fileId ? `https://drive.google.com/file/d/${fileId}/view` : v.localUrl),
          duration: v.duration,
        });
      }
    });

    return list;
  }, [categoryPools, multiVoices]);

  const quickCheckResult = useMemo(() => {
    const raw = quickCheckInput.trim();
    if (!raw) return null;
    const fileId = extractGoogleDriveFileId(raw);
    const searchLower = raw.toLowerCase();

    const matches = allDriveLinks.filter((item) => {
      if (fileId && item.fileId === fileId) return true;
      if (item.name.toLowerCase().includes(searchLower)) return true;
      if (item.fileName.toLowerCase().includes(searchLower)) return true;
      if (item.driveUrl.toLowerCase().includes(searchLower)) return true;
      return false;
    });

    return {
      query: raw,
      fileId,
      found: matches.length > 0,
      matches,
    };
  }, [quickCheckInput, allDriveLinks]);

  const filteredDriveLinks = useMemo(() => {
    let result = allDriveLinks;

    if (driveHistoryCategoryFilter !== "all") {
      result = result.filter((it) => it.category === driveHistoryCategoryFilter);
    }

    const q = driveHistorySearchText.trim().toLowerCase();
    if (q) {
      const qFileId = extractGoogleDriveFileId(q);
      result = result.filter((it) => {
        if (qFileId && it.fileId === qFileId) return true;
        if (it.name.toLowerCase().includes(q)) return true;
        if (it.fileName.toLowerCase().includes(q)) return true;
        if (it.driveUrl.toLowerCase().includes(q)) return true;
        if (it.fileId.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    return result;
  }, [allDriveLinks, driveHistoryCategoryFilter, driveHistorySearchText]);

  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<
    Array<{
      id: string;
      type: "info" | "success" | "error" | "forbidden";
      title?: string;
      text: string;
    }>
  >([]);

  const addToast = useCallback(
    (
      toast: {
        type: "info" | "success" | "error" | "forbidden";
        title?: string;
        text: string;
      } | null,
    ) => {
      if (!toast) return;
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, ...toast }]);
      setTimeout(
        () => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        },
        toast.type === "forbidden" ? 7000 : 5000,
      );
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notifyPermissionDenied = useCallback(
    (customMessage?: string) => {
      const detail = customMessage ? `: ${customMessage}` : "";
      addToast({
        type: "forbidden",
        title: "Từ chối truy cập (403)",
        text: `Bạn không có quyền thực hiện thao tác này${detail}. Vui lòng liên hệ chủ dự án để được cấp quyền.`,
      });
    },
    [addToast],
  );

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const res = await fetch(input, init);
      if (res.status === 403) {
        try {
          const cloned = res.clone();
          const errData = await cloned.json();
          notifyPermissionDenied(errData.error);
        } catch {
          notifyPermissionDenied();
        }
      }
      return res;
    },
    [notifyPermissionDenied],
  );

  // Backwards-compatible alias so existing logic continues to work seamlessly
  const setStatusBanner = addToast;

  // Block F5 / reload / tab close when rendering batch
  useEffect(() => {
    if (!isRenderingBatch) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "Quá trình kết xuất video đang diễn ra. Nếu rời khỏi trang, tiến trình sẽ bị hủy. Bạn có chắc muốn rời đi?";
      return e.returnValue;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F5" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r")) {
        e.preventDefault();
        setStatusBanner({
          type: "error",
          text: "Đang trong quá trình render video! Vui lòng không làm mới (F5) trang để tránh mất tiến trình.",
        });
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isRenderingBatch, setStatusBanner]);

  // Hidden file inputs
  const singleVideoInputRef = useRef<HTMLInputElement | null>(null);
  const masterFolderInputRef = useRef<HTMLInputElement | null>(null);
  const categoryInputRefs = useRef<Record<ShotCategory, HTMLInputElement | null>>({
    open: null,
    product: null,
    texture: null,
    apply: null,
    end: null,
  });
  const voiceInputRef = useRef<HTMLInputElement | null>(null);

  // Load project details (name, categoryPools, renderedCount, settings, siblingFolders) for this projectId
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/project/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.project?.name) {
          setCurrentProjectName(data.project.name);
        }
        if (data.project?.parentProjectId) {
          setParentProjectIdState(data.project.parentProjectId);
        }
        if (data.project?.parentProjectName) {
          setParentProjectNameState(data.project.parentProjectName);
        }
        if (Array.isArray(data.siblingFolders)) {
          setSiblingFolders(data.siblingFolders);
        }
        if (data.categoryPools) {
          setCategoryPools(data.categoryPools);
        }
        if (data.voiceTracks) {
          setMultiVoices(data.voiceTracks);
        }
        if (data.access) {
          setAccessState(data.access);
        }

        const fullDefaultPrefix = data.project?.parentProjectName
          ? `${data.project.parentProjectName} - ${data.project.name || ""}`
          : data.project?.name || "";

        if (data.project?.settings) {
          const s = data.project.settings;
          if (typeof s.targetMixDuration === "number") {
            setTargetMixDuration(s.targetMixDuration);
          }
          if (typeof s.targetMixCount === "number") {
            setTargetMixCount(s.targetMixCount);
          }
          if (s.mixVoiceMode === "none" || s.mixVoiceMode === "rotate") {
            setMixVoiceMode(s.mixVoiceMode);
          }
          if (typeof s.clipNamePrefix === "string" && s.clipNamePrefix.trim()) {
            setClipNamePrefix(s.clipNamePrefix.trim());
          } else if (fullDefaultPrefix) {
            setClipNamePrefix(fullDefaultPrefix);
          }
        } else if (fullDefaultPrefix) {
          setClipNamePrefix(fullDefaultPrefix);
        }
        if (typeof data.renderedCount === "number") {
          setProjectRenderedCount(data.renderedCount);
        }
      })
      .catch(() => {});
  }, [projectId]);

  // Load project state and category library on mount or when sessionId is ready
  useEffect(() => {
    if (!sessionId) return;
    const sid = sessionId;

    fetch(`/api/project?sessionId=${encodeURIComponent(sid)}`, {
      headers: { "x-session-id": sid },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.state) {
          setState(data.state);
          if (data.state.shots?.length > 0) {
            setSelectedShotId(data.state.shots[0].id);
          }
          if (data.state.composedVideos?.length > 0) {
            setSelectedComposedId(data.state.composedVideos[0].id);
          }
          if (data.state.diversityConfig?.targetOutputDuration) {
            setTargetMixDuration(data.state.diversityConfig.targetOutputDuration);
          }
        }
      })
      .catch(() => {});

    fetch(
      `/api/category-library?sessionId=${encodeURIComponent(
        sid,
      )}&projectId=${encodeURIComponent(projectId)}`,
      {
        headers: { "x-session-id": sid },
      },
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.categoryPools) setCategoryPools(data.categoryPools);
        if (data.multiVoiceTracks) setMultiVoices(data.multiVoiceTracks);
      })
      .catch(() => {});
  }, [sessionId, projectId]);

  const persistState = useCallback(
    async (nextState: ProjectState) => {
      setState(nextState);
      try {
        await fetch("/api/project", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-session-id": sessionId,
          },
          body: JSON.stringify({ state: nextState, sessionId }),
        });

        // Đồng bộ lưu cấu hình cài đặt lên SQLite Cloud theo projectId
        if (projectId) {
          fetch(`/api/project/${projectId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              settings: {
                targetMixDuration,
                targetMixCount,
                mixVoiceMode,
                clipNamePrefix,
                categoryMinDurations: nextState.categoryMinDurations,
              },
            }),
          }).catch(() => {});
        }
      } catch {
        // ignore transient save error
      }
    },
    [sessionId, projectId, targetMixDuration, targetMixCount, mixVoiceMode, clipNamePrefix],
  );

  const persistProjectSettings = useCallback(
    (
      overrides?: Partial<{
        targetMixDuration: number;
        targetMixCount: number;
        mixVoiceMode: "none" | "rotate";
        clipNamePrefix: string;
      }>,
    ) => {
      if (!projectId) return;
      fetch(`/api/project/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            targetMixDuration,
            targetMixCount,
            mixVoiceMode,
            clipNamePrefix,
            ...overrides,
          },
        }),
      }).catch(() => {});
    },
    [projectId, targetMixDuration, targetMixCount, mixVoiceMode, clipNamePrefix],
  );

  // Auto-detect and sync exact video duration from browser decoder for all category pool items
  const probedItemIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    for (const cat of CATEGORY_ORDER) {
      for (const item of categoryPools[cat] || []) {
        if (!item.localUrl || probedItemIdsRef.current.has(item.id)) continue;
        probedItemIdsRef.current.add(item.id);

        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = item.localUrl;
        v.onloadedmetadata = () => {
          if (!active || !v.duration || isNaN(v.duration) || v.duration <= 0.1) return;
          const exactDur = Math.round(v.duration * 10) / 10;
          if (Math.abs(exactDur - item.duration) > 0.05) {
            setCategoryPools((prev) => {
              const currentList = prev[cat] || [];
              const updated = currentList.map((it) =>
                it.id === item.id ? { ...it, duration: exactDur } : it,
              );
              return { ...prev, [cat]: updated };
            });
          }
        };
      }
    }

    return () => {
      active = false;
    };
  }, [categoryPools]);

  // Auto-detect and sync exact voice duration from browser decoder for all multiVoice items
  const probedVoiceIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    for (const voice of multiVoices) {
      if (!voice.localUrl || probedVoiceIdsRef.current.has(voice.id)) continue;
      probedVoiceIdsRef.current.add(voice.id);

      const a = document.createElement("audio");
      a.preload = "metadata";
      a.src = voice.localUrl;
      a.onloadedmetadata = () => {
        if (!active || !a.duration || isNaN(a.duration) || a.duration <= 0.1) return;
        const exactDur = Math.round(a.duration * 10) / 10;
        if (Math.abs(exactDur - voice.duration) > 0.05) {
          setMultiVoices((prev) =>
            prev.map((v) => (v.id === voice.id ? { ...v, duration: exactDur } : v)),
          );
        }
      };
    }
    return () => {
      active = false;
    };
  }, [multiVoices]);

  const handleToggleAuditionVoice = (v: MultiVoiceItem) => {
    if (auditionVoiceId === v.id && auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      setAuditionVoiceId(null);
      return;
    }
    if (!auditionAudioRef.current) {
      auditionAudioRef.current = new Audio();
      auditionAudioRef.current.onended = () => setAuditionVoiceId(null);
    }
    auditionAudioRef.current.src = v.localUrl;
    auditionAudioRef.current.currentTime = 0;
    auditionAudioRef.current.play().catch(() => {});
    setAuditionVoiceId(v.id);
  };

  const categoryMinDurations: CategoryMinDurations = useMemo(() => {
    return {
      ...DEFAULT_CATEGORY_MIN_DURATIONS,
      ...(state?.categoryMinDurations || {}),
    };
  }, [state?.categoryMinDurations]);

  // Recalculate shot speed based on category min duration
  const applyMinDurationToShot = useCallback((shot: Shot, minDurs: CategoryMinDurations): Shot => {
    if (!shot.category) return shot;
    const rawDur = Math.max(0.1, shot.end - shot.begin);
    const minDur = minDurs[shot.category] ?? DEFAULT_CATEGORY_MIN_DURATIONS[shot.category];
    const speed = computeShotSpeedForMinDuration(rawDur, minDur);
    return {
      ...shot,
      edits: {
        ...shot.edits,
        speed,
      },
    };
  }, []);

  const selectedShot = useMemo(() => {
    if (!state || !selectedShotId) return null;
    return state.shots.find((s) => s.id === selectedShotId) || null;
  }, [state, selectedShotId]);

  const splitCatShots = useMemo(() => {
    if (!state || !splitEditingCategory) return [];
    return state.shots.filter((s) => s.category === splitEditingCategory);
  }, [state, splitEditingCategory]);

  const accordionShot = useMemo(() => {
    if (!state || !accordionShotId) return null;
    return state.shots.find((s) => s.id === accordionShotId) || null;
  }, [state, accordionShotId]);

  const splitShotTrimInfo = useMemo(() => {
    if (!accordionShot) return null;
    const cat = accordionShot.category || "product";
    const baseStart = accordionShot.rawBegin ?? accordionShot.begin;
    const baseEnd = accordionShot.rawEnd ?? accordionShot.end;
    const rawDuration = Math.max(0.2, baseEnd - baseStart);
    const cutDur = Math.max(0.1, accordionShot.end - accordionShot.begin);
    const speed = accordionShot.edits.speed || 1.0;
    const effectiveDur = cutDur / speed;
    const minDur = categoryMinDurations[cat] ?? 3.0;
    return {
      baseStart,
      baseEnd,
      rawDuration,
      cutDur,
      speed,
      effectiveDur,
      minDur,
    };
  }, [accordionShot, categoryMinDurations]);

  const handleSelectSplitShot = (shot: Shot) => {
    setSelectedShotId(shot.id);
    if (slicerVideoRef.current) {
      slicerVideoRef.current.currentTime = shot.begin;
    }
    setSlicerTime(shot.begin);
  };

  const selectedComposed = useMemo(() => {
    if (!state || state.composedVideos.length === 0) return null;
    return state.composedVideos.find((c) => c.id === selectedComposedId) || state.composedVideos[0];
  }, [state, selectedComposedId]);

  const selectedVoiceTrack: VoiceTrack | null = useMemo(() => {
    if (!selectedComposed?.voiceTrackId) return null;
    const found = multiVoices.find((v) => v.id === selectedComposed.voiceTrackId);
    if (found) {
      return {
        id: found.id,
        name: found.name,
        fileName: found.fileName,
        localUrl: found.localUrl,
        localPath: found.localPath || "",
        sizeBytes: 0,
        duration: found.duration || 20,
        createdAt: "",
      };
    }
    if (state?.voiceTrack?.id === selectedComposed.voiceTrackId) {
      return state.voiceTrack;
    }
    return null;
  }, [selectedComposed, multiVoices, state]);

  // Category counts
  const categoryStats = useMemo(() => {
    const counts: Record<ShotCategory, number> = {
      open: 0,
      product: 0,
      texture: 0,
      apply: 0,
      end: 0,
    };
    if (!state) return { counts, allFilled: false };
    for (const s of state.shots) {
      if (s.category && s.end > s.begin) {
        counts[s.category]++;
      }
    }
    const allFilled = CATEGORY_ORDER.every((c) => counts[c] >= 1);
    return { counts, allFilled };
  }, [state]);

  // ==========================================
  // TAB 1 ACTIONS (Tách 1 Video & Slicer Studio)
  // ==========================================

  const sanitizeUploadFile = (file: File, defaultExt = ".mp4", defaultType = "video/mp4"): File => {
    const originalName = file.name || "media";
    const asciiBase = originalName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(asciiBase);
    const safeName = hasExt ? asciiBase : `${asciiBase}${defaultExt}`;
    return new File([file], safeName, {
      type: file.type || defaultType,
    });
  };

  // Helper tải file theo mảnh (Chunked Streaming Upload: 20MB / chunk) có auto-retry 3 lần
  const uploadFileInChunks = async (
    file: File,
    options: {
      endpoint: string;
      kind?: "source" | "voice";
      targetCategory?: ShotCategory | "voice";
      relativePath?: string;
      duration?: number;
      width?: number;
      height?: number;
      onProgress?: (loaded: number, total: number) => void;
    },
  ) => {
    const CHUNK_SIZE = 20 * 1024 * 1024; // 20 MB / chunk
    const totalBytes = file.size;
    const totalChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
    const uploadId = generateUploadId();

    let lastData: any = null;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(totalBytes, start + CHUNK_SIZE);
      const chunkBlob = file.slice(start, end);

      let attempt = 0;
      let success = false;
      let lastError: any = null;

      while (attempt < 3 && !success) {
        attempt++;
        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/octet-stream",
            "x-session-id": sessionId,
            "x-upload-id": uploadId,
            "x-chunk-index": String(chunkIndex),
            "x-total-chunks": String(totalChunks),
            "x-file-name": encodeURIComponent(file.name),
            "x-file-size": String(totalBytes),
          };

          if (projectId) headers["x-project-id"] = projectId;
          if (options.kind) headers["x-upload-kind"] = options.kind;
          if (options.targetCategory) headers["x-target-category"] = options.targetCategory;
          if (options.relativePath)
            headers["x-relative-path"] = encodeURIComponent(options.relativePath);
          if (options.duration) headers["x-video-duration"] = String(options.duration);
          if (options.width) headers["x-video-width"] = String(options.width);
          if (options.height) headers["x-video-height"] = String(options.height);

          const res = await fetch(options.endpoint, {
            method: "POST",
            headers,
            body: chunkBlob,
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || `HTTP ${res.status}`);
          }

          lastData = data;
          success = true;
          if (options.onProgress) {
            options.onProgress(end, totalBytes);
          }
        } catch (err: any) {
          lastError = err;
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, attempt * 1000));
          }
        }
      }

      if (!success) {
        throw new Error(
          `Lỗi tải mảnh ${chunkIndex + 1}/${totalChunks} của file "${file.name}": ${
            lastError?.message || "Mất kết nối mạng"
          }`,
        );
      }
    }

    return lastData;
  };

  const handleUploadSingleSource = async (file: File) => {
    if (!file) return;

    const MAX_ALLOWED = 500 * 1024 * 1024;
    if (file.size > MAX_ALLOWED) {
      setStatusBanner({
        type: "error",
        text: `File "${file.name}" (${(file.size / 1024 / 1024).toFixed(
          1,
        )} MB) vượt quá giới hạn tối đa cho phép (${MAX_ALLOWED / 1024 / 1024} MB).`,
      });
      return;
    }

    setBusyMessage(`Đang chuẩn bị tải lên video ${file.name}...`);
    setStatusBanner(null);
    setUploadProgress({
      loadedBytes: 0,
      totalBytes: file.size,
      percent: 0,
      fileName: file.name,
    });

    try {
      // Chuẩn hóa tên file sang ASCII và bổ sung đuôi .mp4 nếu file thiếu đuôi (tránh lỗi multipart FormData Next.js)
      const safeUploadFile = sanitizeUploadFile(file, ".mp4", "video/mp4");

      let duration = 0;
      let width = 1080;
      let height = 1920;
      let localBlobUrl = "";
      try {
        const videoEl = document.createElement("video");
        videoEl.preload = "metadata";
        localBlobUrl = URL.createObjectURL(safeUploadFile);
        videoEl.src = localBlobUrl;
        await new Promise<void>((resolve) => {
          videoEl.onloadedmetadata = () => {
            duration = videoEl.duration || 0;
            width = videoEl.videoWidth || 1080;
            height = videoEl.videoHeight || 1920;
            resolve();
          };
          videoEl.onerror = () => {
            resolve();
          };
          setTimeout(resolve, 2000);
        });
      } catch {
        // fallback
      }

      setSourceBlobUrl(localBlobUrl);

      const data = await uploadFileInChunks(safeUploadFile, {
        endpoint: "/api/upload-local",
        kind: "source",
        duration,
        width,
        height,
        onProgress: (loaded, total) => {
          const percent = Math.min(100, Math.round((loaded / total) * 100));
          setUploadProgress({
            loadedBytes: loaded,
            totalBytes: total,
            percent,
            fileName: file.name,
          });
          setBusyMessage(
            `Đang tải lên video: ${percent}% (${(loaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB)`,
          );
        },
      });

      setState(data.state);
      if (data.state.shots?.length > 0) {
        setSelectedShotId(data.state.shots[0].id);
      }
      setStatusBanner({
        type: "success",
        text: `Đã nạp video "${file.name}" (${(file.size / 1024 / 1024).toFixed(
          1,
        )} MB). Hãy bấm Auto detect hoặc tách cảnh thủ công!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setBusyMessage(null);
      setUploadProgress(null);
    }
  };

  const handleRunPySceneDetect = async () => {
    if (!state?.sourceVideo) {
      setStatusBanner({
        type: "error",
        text: "Vui lòng upload 1 video trước khi detect.",
      });
      return;
    }
    setBusyMessage("Đang quét phân tích frame (PySceneDetect ContentDetector)...");
    setStatusBanner(null);
    try {
      const res = await fetch("/api/detect-scenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          sessionId,
          detector: pyDetector,
          threshold: pyThreshold,
          minSceneLen: pyMinSceneLen,
          categoryMinDurations,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi phân tích chuyển cảnh");

      setState(data.state);
      if (data.state.shots?.length > 0) {
        setSelectedShotId(data.state.shots[0].id);
        if (slicerVideoRef.current) {
          slicerVideoRef.current.currentTime = data.state.shots[0].begin;
          setSlicerTime(data.state.shots[0].begin);
        }
      }
      setStatusBanner({
        type: "success",
        text: `Auto detect thành công! Đã tách thành ${data.totalDetected} cảnh theo 5 category chuẩn. Bạn có thể tinh chỉnh số giây và xem trước từng cảnh!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setBusyMessage(null);
    }
  };

  const handleCategoryChange = (shotId: string, newCat: ShotCategory) => {
    if (!state) return;
    const nextShots = state.shots.map((s) => {
      if (s.id !== shotId) return s;
      return applyMinDurationToShot({ ...s, category: newCat }, categoryMinDurations);
    });
    persistState({ ...state, shots: nextShots });
  };

  const handleDeleteShot = (shotId: string) => {
    if (!state) return;
    const nextShots = state.shots.filter((s) => s.id !== shotId);
    persistState({ ...state, shots: nextShots });
    if (selectedShotId === shotId) {
      setSelectedShotId(nextShots[0]?.id || null);
    }
  };

  // Play only active shot (begin -> end)
  const handlePlayActiveShot = (shot?: Shot | null) => {
    const targetShot = shot || selectedShot;
    if (!targetShot || !slicerVideoRef.current) return;

    slicerVideoRef.current.currentTime = targetShot.begin;
    slicerVideoRef.current.playbackRate = Math.min(4, Math.max(0.25, targetShot.edits.speed || 1));
    slicerVideoRef.current.play().catch(() => {});
    setIsPlayingSlicer(true);
    setPlayingShotOnly(true);
  };

  const handleStopSlicer = () => {
    if (!slicerVideoRef.current) return;
    slicerVideoRef.current.pause();
    setIsPlayingSlicer(false);
    setPlayingShotOnly(false);
  };

  // Split shot at current playhead or midpoint
  const handleSplitAtTime = useCallback(
    (targetSec: number) => {
      if (!state) return;
      const shotToSplit =
        state.shots.find((s) => targetSec > s.begin + 0.3 && targetSec < s.end - 0.3) ||
        selectedShot;

      if (!shotToSplit) {
        setStatusBanner({
          type: "error",
          text: "Hãy chọn 1 shot hoặc di chuyển thanh thời gian vào giữa đoạn cần tách.",
        });
        return;
      }

      const cutPoint =
        targetSec > shotToSplit.begin + 0.2 && targetSec < shotToSplit.end - 0.2
          ? Math.round(targetSec * 10) / 10
          : Math.round(((shotToSplit.begin + shotToSplit.end) / 2) * 10) / 10;

      if (cutPoint <= shotToSplit.begin + 0.2 || cutPoint >= shotToSplit.end - 0.2) {
        return;
      }

      const firstHalf = applyMinDurationToShot(
        {
          ...shotToSplit,
          end: cutPoint,
          rawBegin: shotToSplit.rawBegin ?? shotToSplit.begin,
          rawEnd: cutPoint,
          label: `${shotToSplit.label} (P1)`,
        },
        categoryMinDurations,
      );
      const secondHalf = applyMinDurationToShot(
        {
          ...shotToSplit,
          id: `shot_${Date.now()}`,
          begin: cutPoint,
          end: shotToSplit.end,
          rawBegin: cutPoint,
          rawEnd: shotToSplit.rawEnd ?? shotToSplit.end,
          label: `${shotToSplit.label} (P2)`,
          edits: { ...shotToSplit.edits },
        },
        categoryMinDurations,
      );

      const nextShots: Shot[] = [];
      for (const s of state.shots) {
        if (s.id === shotToSplit.id) {
          nextShots.push(firstHalf, secondHalf);
        } else {
          nextShots.push(s);
        }
      }

      persistState({ ...state, shots: nextShots });
      setSelectedShotId(secondHalf.id);
      setStatusBanner({
        type: "success",
        text: `Đã tách đôi shot tại mốc ${cutPoint}s!`,
      });
    },
    [
      state,
      selectedShot,
      categoryMinDurations,
      applyMinDurationToShot,
      persistState,
      setStatusBanner,
    ],
  );

  // Merge shot with next shot
  const handleMergeWithNext = (shotId: string) => {
    if (!state) return;
    const idx = state.shots.findIndex((s) => s.id === shotId);
    if (idx === -1 || idx >= state.shots.length - 1) {
      setStatusBanner({
        type: "error",
        text: "Không có shot kế tiếp liền kề để gộp.",
      });
      return;
    }

    const currentShot = state.shots[idx];
    const nextShot = state.shots[idx + 1];

    const mergedShot = applyMinDurationToShot(
      {
        ...currentShot,
        end: nextShot.end,
        rawBegin: currentShot.rawBegin ?? currentShot.begin,
        rawEnd: nextShot.rawEnd ?? nextShot.end,
        label: `${currentShot.label} + ${nextShot.label}`,
      },
      categoryMinDurations,
    );

    const nextShots = state.shots.filter((_, i) => i !== idx && i !== idx + 1);
    nextShots.splice(idx, 0, mergedShot);

    persistState({ ...state, shots: nextShots });
    setSelectedShotId(mergedShot.id);
    setStatusBanner({
      type: "success",
      text: `Đã gộp thành công 2 cảnh liền kề thành cảnh mới dài ${(
        mergedShot.end - mergedShot.begin
      ).toFixed(1)}s!`,
    });
  };

  // Update shot begin and end (absolute timestamps in source video)
  const handleUpdateShotTrim = (shotId: string, newBegin: number, newEnd: number) => {
    if (!state) return;
    const maxDur = state.sourceVideo?.duration || 99999;
    const roundedBegin = Math.max(0, Math.min(maxDur - 0.2, Math.round(newBegin * 10) / 10));
    const roundedEnd = Math.max(roundedBegin + 0.2, Math.min(maxDur, Math.round(newEnd * 10) / 10));

    const nextShots = state.shots.map((s) => {
      if (s.id !== shotId) return s;
      return {
        ...s,
        rawBegin: s.rawBegin ?? s.begin,
        rawEnd: s.rawEnd ?? s.end,
        begin: roundedBegin,
        end: roundedEnd,
      };
    });
    persistState({ ...state, shots: nextShots });
  };

  const handleUpdateShotEdits = (shotId: string, edits: Partial<ShotEdits>) => {
    if (!state) return;
    const nextShots = state.shots.map((s) => {
      if (s.id !== shotId) return s;
      return {
        ...s,
        edits: {
          ...s.edits,
          ...edits,
        },
      };
    });
    persistState({ ...state, shots: nextShots });
  };

  // Direct begin/end editing with step 0.1s
  const handleUpdateShotTime = (shotId: string, field: "begin" | "end", val: number) => {
    if (!state) return;
    const rounded = Math.round(val * 10) / 10;
    const nextShots = state.shots.map((s) => {
      if (s.id !== shotId) return s;
      const updated = {
        ...s,
        [field]: rounded,
      };
      if (updated.end <= updated.begin + 0.2) {
        updated.end = Math.round((updated.begin + 0.3) * 10) / 10;
      }
      return applyMinDurationToShot(updated, categoryMinDurations);
    });
    persistState({ ...state, shots: nextShots });
  };

  // Per-shot inspector edits
  const handleToggleFlipH = (shotId: string) => {
    if (!state) return;
    const nextShots = state.shots.map((s) =>
      s.id === shotId ? { ...s, edits: { ...s.edits, flipH: !s.edits.flipH } } : s,
    );
    persistState({ ...state, shots: nextShots });
  };

  const handleToggleLockFlipH = (shotId: string) => {
    if (!state) return;
    const nextShots = state.shots.map((s) =>
      s.id === shotId ? { ...s, edits: { ...s.edits, lockFlipH: !s.edits.lockFlipH } } : s,
    );
    persistState({ ...state, shots: nextShots });
  };

  const handleSetSpeed = (shotId: string, speed: number) => {
    if (!state) return;
    const nextShots = state.shots.map((s) =>
      s.id === shotId ? { ...s, edits: { ...s.edits, speed } } : s,
    );
    persistState({ ...state, shots: nextShots });
  };

  const handleSetZoom = (shotId: string, depth: number | false) => {
    if (!state) return;
    const nextShots = state.shots.map((s) =>
      s.id === shotId
        ? {
            ...s,
            edits: {
              ...s.edits,
              zoom: depth ? { depth } : false,
            },
          }
        : s,
    );
    persistState({ ...state, shots: nextShots });
  };

  const keyActionsRef = useRef<{
    handleCategoryChange: (shotId: string, newCat: ShotCategory) => void;
    handleSplitAtTime: (targetSec: number) => void;
    handleToggleFlipH: (shotId: string) => void;
    handleToggleLockFlipH: (shotId: string) => void;
    handleStopSlicer: () => void;
    handlePlayActiveShot: (shot?: Shot | null) => void;
    selectedShotId: string | null;
    slicerTime: number;
    isPlayingSlicer: boolean;
  } | null>(null);

  useEffect(() => {
    keyActionsRef.current = {
      handleCategoryChange,
      handleSplitAtTime,
      handleToggleFlipH,
      handleToggleLockFlipH,
      handleStopSlicer,
      handlePlayActiveShot,
      selectedShotId,
      slicerTime,
      isPlayingSlicer,
    };
  });

  // Keyboard Shortcuts (1-5, S, M, L, Space)
  useEffect(() => {
    if (mainTab !== "split") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const actions = keyActionsRef.current;
      if (!actions) return;

      if (e.key >= "1" && e.key <= "5") {
        const catMap: Record<string, ShotCategory> = {
          "1": "open",
          "2": "product",
          "3": "texture",
          "4": "apply",
          "5": "end",
        };
        const targetCat = catMap[e.key];
        if (actions.selectedShotId && targetCat) {
          e.preventDefault();
          actions.handleCategoryChange(actions.selectedShotId, targetCat);
        }
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        actions.handleSplitAtTime(actions.slicerTime);
      } else if (e.key === "m" || e.key === "M") {
        if (actions.selectedShotId) {
          e.preventDefault();
          actions.handleToggleFlipH(actions.selectedShotId);
        }
      } else if (e.key === "l" || e.key === "L") {
        if (actions.selectedShotId) {
          e.preventDefault();
          actions.handleToggleLockFlipH(actions.selectedShotId);
        }
      } else if (e.key === " " && !e.repeat) {
        e.preventDefault();
        if (actions.isPlayingSlicer) {
          actions.handleStopSlicer();
        } else {
          actions.handlePlayActiveShot();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mainTab]);

  // Slice and download ZIP containing 5 category folders
  const handleSliceAndDownloadZip = async () => {
    if (!state?.sourceVideo || state.shots.length === 0) {
      setStatusBanner({ type: "error", text: "Chưa có cảnh nào để xuất." });
      return;
    }
    setIsSlicing(true);
    setBusyMessage("Đang cắt video thành các file .mp4 riêng biệt và nén ZIP...");
    try {
      const res = await fetch("/api/slice-scenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          filePath: state.sourceVideo.localPath,
          scenes: state.shots,
          categoryMinDurations,
          sessionId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `lachvid_categories_${sessionId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      setStatusBanner({
        type: "success",
        text: `Đã cắt thành công ${state.shots.length} clip và tải về file ZIP (chứa sẵn 5 folder OPEN, PRODUCT, TEXTURE, APPLY, END)!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setIsSlicing(false);
      setBusyMessage(null);
    }
  };

  // Direct save to folder on computer using File System Access API
  const handleDirectSaveToFolder = async () => {
    if (!state?.sourceVideo || state.shots.length === 0) {
      setStatusBanner({ type: "error", text: "Chưa có cảnh nào để xuất." });
      return;
    }

    if (!("showDirectoryPicker" in window)) {
      setStatusBanner({
        type: "info",
        text: "Trình duyệt của bạn chưa hỗ trợ chọn thư mục trực tiếp. Hệ thống sẽ tự động chuyển sang tải file .ZIP chia sẵn 5 folder!",
      });
      await handleSliceAndDownloadZip();
      return;
    }

    try {
      const picker = (
        window as unknown as {
          showDirectoryPicker?: (opts: unknown) => Promise<any>;
        }
      ).showDirectoryPicker;
      if (!picker) throw new Error("showDirectoryPicker không khả dụng");
      const rootDirHandle = await picker({ mode: "readwrite" });

      setIsSlicing(true);
      setBusyMessage("Đang cắt các clip và chuẩn bị ghi vào ổ cứng...");

      const res = await fetch("/api/slice-scenes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          filePath: state.sourceVideo.localPath,
          scenes: state.shots,
          categoryMinDurations,
          sessionId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      setBusyMessage("Đang ghi thẳng các file .mp4 vào đúng các thư mục trên máy tính...");
      const zipBlob = await res.blob();
      const zip = await JSZip.loadAsync(zipBlob);

      let savedCount = 0;
      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        const parts = relativePath.split("/");
        const catName = parts[0]?.toUpperCase() || "PRODUCT";
        const fileName = parts[parts.length - 1];

        const catDirHandle = await rootDirHandle.getDirectoryHandle(catName, {
          create: true,
        });

        const fileBlob = await zipEntry.async("blob");
        const fileHandle = await catDirHandle.getFileHandle(fileName, {
          create: true,
        });
        const writable = await fileHandle.createWritable();
        await writable.write(fileBlob);
        await writable.close();
        savedCount++;
      }

      setStatusBanner({
        type: "success",
        text: `Tuyệt vời! Đã ghi thẳng ${savedCount} clip .mp4 vào đúng các folder OPEN, PRODUCT, TEXTURE, APPLY, END trên máy tính!`,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setIsSlicing(false);
      setBusyMessage(null);
    }
  };

  // Reset to process next video (up to 50 videos)
  const handleNextVideo = async () => {
    if (!state) return;
    try {
      await authFetch("/api/project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({ action: "reset_source", sessionId }),
      });
    } catch {
      // ignore
    }
    if (sourceBlobUrl) {
      URL.revokeObjectURL(sourceBlobUrl);
      setSourceBlobUrl(null);
    }
    persistState({
      ...state,
      sourceVideo: null,
      shots: [],
    });
    setSelectedShotId(null);
    setStatusBanner({
      type: "info",
      text: "Đã làm sạch không gian làm việc. Bạn hãy chọn video nguồn tiếp theo để tách cảnh!",
    });
  };

  // ==========================================
  // TAB 2 ACTIONS (Trộn theo folder category)
  // ==========================================

  // Mode chính: Nạp danh sách link Google Drive từ bảng 5 cột Excel
  const handleIngestExcelDriveLinks = async () => {
    if (parsedExcel.totalExtracted === 0) {
      setStatusBanner({
        type: "error",
        text: "Chưa tìm thấy link Google Drive hợp lệ nào trong bảng vừa dán.",
      });
      return;
    }

    setIsIngestingDrive(true);
    setBusyMessage(
      `Đang nạp và kiểm tra ${parsedExcel.totalExtracted} link Google Drive từ các cột...`,
    );
    setStatusBanner(null);

    try {
      const res = await authFetch("/api/category-library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          action: "ingest_drive_links",
          sessionId,
          projectId: projectId || undefined,
          categoryLinks: {
            open: parsedExcel.open,
            product: parsedExcel.product,
            texture: parsedExcel.texture,
            apply: parsedExcel.apply,
            end: parsedExcel.end,
            voice: parsedExcel.voice || [],
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi nạp link Google Drive");

      if (data.categoryPools) {
        setCategoryPools(data.categoryPools);
      }
      if (data.multiVoiceTracks) {
        setMultiVoices(data.multiVoiceTracks);
      }

      setExcelPasteText("");

      let resultMsg = `Đã nạp thành công ${data.addedCount} file từ Google Drive vào kho!`;
      if (data.duplicateCount > 0) {
        resultMsg += ` (Đã bỏ qua ${data.duplicateCount} file bị trùng)`;
      }
      if (data.errors && data.errors.length > 0) {
        resultMsg += ` — Lưu ý: Có ${data.errors.length} link chưa mở quyền công khai.`;
      }

      setStatusBanner({
        type: data.addedCount > 0 ? "success" : "info",
        text: resultMsg,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setIsIngestingDrive(false);
      setBusyMessage(null);
    }
  };

  // Nạp link Google Drive vào 1 cột category hoặc voice cụ thể
  const handleIngestSingleCategoryDrive = async (
    category: ShotCategory | "voice",
    text: string,
  ) => {
    const rawLinks = text
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const validFileIds = rawLinks
      .map((r) => extractGoogleDriveFileId(r))
      .filter((id): id is string => Boolean(id));

    if (validFileIds.length === 0) {
      setStatusBanner({
        type: "error",
        text: "Chưa tìm thấy link Google Drive hợp lệ nào.",
      });
      return;
    }

    const catLabel = category === "voice" ? "Voice (lồng tiếng)" : category.toUpperCase();
    setIsIngestingDrive(true);
    setBusyMessage(`Đang nạp ${validFileIds.length} link vào mục ${catLabel}...`);
    setStatusBanner(null);

    try {
      const res = await authFetch("/api/category-library", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          action: "ingest_drive_links",
          sessionId,
          projectId: projectId || undefined,
          targetCategory: category,
          links: validFileIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi nạp link Google Drive");

      if (data.categoryPools) {
        setCategoryPools(data.categoryPools);
      }
      if (data.multiVoiceTracks) {
        setMultiVoices(data.multiVoiceTracks);
      }
      setSingleCategoryDriveModal(null);

      let msg = `Đã nạp thành công ${data.addedCount} file vào mục ${catLabel}!`;
      if (data.duplicateCount > 0) {
        msg += ` (Đã bỏ qua ${data.duplicateCount} file bị trùng)`;
      }
      setStatusBanner({
        type: "success",
        text: msg,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setIsIngestingDrive(false);
      setBusyMessage(null);
    }
  };

  // Smart Batching & Chunked Upload cho danh sách nhiều file ở Bước 2
  const uploadCategoryFilesSmart = async (
    files: File[],
    targetCategory?: ShotCategory | "voice",
  ) => {
    const BATCH_SIZE_LIMIT = 20 * 1024 * 1024; // Gom lô <= 20 MB để luôn đi qua Cloudflare an toàn
    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    let loadedBytes = 0;

    setUploadProgress({
      loadedBytes: 0,
      totalBytes,
      percent: 0,
    });

    // Tách riêng các file nặng > 20MB (cần cắt chunk) và các file nhỏ <= 20MB (gom lô)
    const largeFiles: File[] = [];
    const smallFiles: File[] = [];

    for (const f of files) {
      if (f.size > BATCH_SIZE_LIMIT) {
        largeFiles.push(f);
      } else {
        smallFiles.push(f);
      }
    }

    // 1. Tải các file nhỏ theo từng lô <= 20MB
    if (smallFiles.length > 0) {
      let currentBatch: File[] = [];
      let currentBatchBytes = 0;

      for (let i = 0; i < smallFiles.length; i++) {
        const file = smallFiles[i];
        if (currentBatchBytes + file.size > BATCH_SIZE_LIMIT && currentBatch.length > 0) {
          // Gửi lô hiện tại
          await sendBatchFormData(currentBatch, targetCategory);
          loadedBytes += currentBatchBytes;
          const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
          setUploadProgress({
            loadedBytes,
            totalBytes,
            percent,
          });
          setBusyMessage(
            `Đang tải lên kho: ${percent}% (${(loadedBytes / 1024 / 1024).toFixed(1)} / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`,
          );
          currentBatch = [];
          currentBatchBytes = 0;
        }
        currentBatch.push(file);
        currentBatchBytes += file.size;
      }

      if (currentBatch.length > 0) {
        await sendBatchFormData(currentBatch, targetCategory);
        loadedBytes += currentBatchBytes;
        const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
        setUploadProgress({
          loadedBytes,
          totalBytes,
          percent,
        });
        setBusyMessage(
          `Đang tải lên kho: ${percent}% (${(loadedBytes / 1024 / 1024).toFixed(1)} / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`,
        );
      }
    }

    // 2. Tải các file nặng lẻ qua cơ chế Chunked Upload (20MB / chunk)
    for (const file of largeFiles) {
      const relPath = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || "";
      let previousFileLoaded = 0;
      await uploadFileInChunks(file, {
        endpoint: "/api/category-library",
        targetCategory,
        relativePath: relPath,
        onProgress: (chunkLoaded) => {
          const delta = chunkLoaded - previousFileLoaded;
          previousFileLoaded = chunkLoaded;
          loadedBytes += delta;
          const percent = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
          setUploadProgress({
            loadedBytes,
            totalBytes,
            percent,
            fileName: file.name,
          });
          setBusyMessage(
            `Đang tải lên file "${file.name}": ${percent}% (${(loadedBytes / 1024 / 1024).toFixed(1)} / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`,
          );
        },
      });
    }

    // Đồng bộ lại state kho clip mới nhất
    const refreshRes = await authFetch(
      `/api/category-library?sessionId=${sessionId}${projectId ? `&projectId=${projectId}` : ""}`,
    );
    const refreshData = await refreshRes.json();
    if (refreshData.categoryPools) setCategoryPools(refreshData.categoryPools);
    if (refreshData.multiVoiceTracks) setMultiVoices(refreshData.multiVoiceTracks);
  };

  const sendBatchFormData = async (batchFiles: File[], targetCategory?: ShotCategory | "voice") => {
    const fd = new FormData();
    fd.append("sessionId", sessionId);
    if (projectId) fd.append("projectId", projectId);
    if (targetCategory) fd.append("targetCategory", targetCategory);

    const isVoice = targetCategory === "voice";
    for (const f of batchFiles) {
      const safe = sanitizeUploadFile(
        f,
        isVoice ? ".mp3" : ".mp4",
        isVoice ? "audio/mpeg" : "video/mp4",
      );
      fd.append("files", safe);
    }

    const res = await authFetch("/api/category-library", {
      method: "POST",
      headers: { "x-session-id": sessionId },
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi tải lô file");
    return data;
  };

  // Master folder upload (reads all subfolders OPEN, PRODUCT, TEXTURE, APPLY, END)
  const handleMasterFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList: File[] = [];
    for (let i = 0; i < files.length; i++) fileList.push(files[i]);

    setBusyMessage(`Đang phân loại và nạp ${fileList.length} file từ thư mục...`);
    setStatusBanner(null);
    try {
      await uploadCategoryFilesSmart(fileList);
      setStatusBanner({
        type: "success",
        text: `Đã nạp thành công ${fileList.length} video từ thư mục vào kho category!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setBusyMessage(null);
      setUploadProgress(null);
      if (masterFolderInputRef.current) masterFolderInputRef.current.value = "";
    }
  };

  // Upload into a single specific category column
  const handleCategoryColumnUpload = async (category: ShotCategory, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileList: File[] = [];
    for (let i = 0; i < files.length; i++) fileList.push(files[i]);

    setBusyMessage(`Đang nạp ${fileList.length} video vào ${category.toUpperCase()}...`);
    setStatusBanner(null);
    try {
      await uploadCategoryFilesSmart(fileList, category);
      setStatusBanner({
        type: "success",
        text: `Đã nạp thành công ${fileList.length} video vào mục ${category.toUpperCase()}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setBusyMessage(null);
      setUploadProgress(null);
      if (categoryInputRefs.current[category]) {
        categoryInputRefs.current[category]!.value = "";
      }
    }
  };

  // Multi-voice tracks upload
  const handleVoiceUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileList: File[] = [];
    for (let i = 0; i < files.length; i++) fileList.push(files[i]);

    setBusyMessage(`Đang nạp ${fileList.length} file audio voice...`);
    setStatusBanner(null);
    try {
      await uploadCategoryFilesSmart(fileList, "voice");
      setStatusBanner({
        type: "success",
        text: `Đã nạp thành công ${fileList.length} file lồng tiếng (Voiceovers).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setBusyMessage(null);
      setUploadProgress(null);
      if (voiceInputRef.current) voiceInputRef.current.value = "";
    }
  };

  const handleRemoveCategoryItem = async (cat: ShotCategory, itemId: string) => {
    const fd = new FormData();
    fd.append("sessionId", sessionId);
    fd.append("action", "remove_item");
    fd.append("category", cat);
    fd.append("itemId", itemId);
    if (projectId) fd.append("projectId", projectId);
    const res = await authFetch("/api/category-library", {
      method: "POST",
      headers: { "x-session-id": sessionId },
      body: fd,
    });
    const data = await res.json();
    if (data.categoryPools) setCategoryPools(data.categoryPools);
  };

  const handleRemoveVoiceItem = async (voiceId: string) => {
    if (auditionVoiceId === voiceId && auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      setAuditionVoiceId(null);
    }
    const fd = new FormData();
    fd.append("sessionId", sessionId);
    fd.append("action", "remove_voice");
    fd.append("voiceId", voiceId);
    if (projectId) fd.append("projectId", projectId);
    const res = await authFetch("/api/category-library", {
      method: "POST",
      headers: { "x-session-id": sessionId },
      body: fd,
    });
    const data = await res.json();
    if (data.multiVoiceTracks) setMultiVoices(data.multiVoiceTracks);
  };

  // Confirm and thoroughly clear all categories, voices, and combinations
  const handleConfirmClearAll = async () => {
    setIsClearingAll(true);
    try {
      const fd = new FormData();
      fd.append("action", "clear_all");
      fd.append("sessionId", sessionId);
      if (projectId) fd.append("projectId", projectId);
      const res = await authFetch("/api/category-library", {
        method: "POST",
        headers: { "x-session-id": sessionId },
        body: fd,
      });
      const d = await res.json();
      if (d.categoryPools) setCategoryPools(d.categoryPools);
      setMultiVoices([]);
      setSelectedComposedId(null);
      setExcelPasteText("");
      setState((prev) => ({
        ...prev,
        categoryPools: d.categoryPools || {
          open: [],
          product: [],
          texture: [],
          apply: [],
          end: [],
        },
        multiVoiceTracks: [],
        composedVideos: [],
      }));
      setShowClearConfirmModal(false);
      setStatusBanner({
        type: "success",
        text: "Đã xóa trắng toàn bộ kho clip và các tổ hợp video.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setIsClearingAll(false);
    }
  };

  const fetchRenderedHistory = useCallback(async () => {
    if (!projectId) return;
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`/api/project?id=${encodeURIComponent(projectId)}&history=1`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.history)) {
          setRenderedHistoryList(data.history);
          setProjectRenderedCount(data.history.length);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
    }
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    if (projectId) {
      fetch(`/api/project?id=${projectId}&history=1`)
        .then((res) => res.json())
        .then((data) => {
          if (!ignore && data.history) {
            setRenderedHistoryList(data.history);
          }
        })
        .catch(() => {});
    }
    return () => {
      ignore = true;
    };
  }, [projectId]);

  const handleConfirmClearHistory = async () => {
    if (!projectId) return;
    setIsClearingHistory(true);
    try {
      const res = await authFetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_history", projectId }),
      });
      if (res.ok) {
        setRenderedHistoryList([]);
        setProjectRenderedCount(0);
        setShowClearHistoryConfirmModal(false);
        addToast({
          type: "success",
          text: "Đã xóa toàn bộ lịch sử render của dự án.",
        });
      } else {
        const data = await res.json().catch(() => ({}));
        addToast({
          type: "error",
          text: data?.error || "Không thể xóa lịch sử render.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast({ type: "error", text: msg });
    } finally {
      setIsClearingHistory(false);
    }
  };

  const unrecordedComposedCount = useMemo(() => {
    if (!state?.composedVideos) return 0;
    return state.composedVideos.filter(
      (comp) => !renderedHistoryList.some((r) => r.tupleKey === comp.tupleKey),
    ).length;
  }, [state, renderedHistoryList]);

  const handleConfirmMarkAllRendered = async () => {
    if (!projectId || !state?.composedVideos || state.composedVideos.length === 0) {
      setShowMarkAllRenderedModal(false);
      return;
    }

    setIsMarkingAllRendered(true);
    try {
      const unrecordedVideos = state.composedVideos.filter(
        (comp) => !renderedHistoryList.some((r) => r.tupleKey === comp.tupleKey),
      );

      if (unrecordedVideos.length === 0) {
        addToast({
          type: "info",
          text: "Tất cả video trong danh sách tổ hợp đều đã có trong lịch sử render.",
        });
        setShowMarkAllRenderedModal(false);
        return;
      }

      const records = unrecordedVideos.map((comp) => ({
        tupleKey: comp.tupleKey,
        name: comp.name,
        payload: comp,
      }));

      const res = await fetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_render",
          projectId,
          records,
        }),
      });

      if (res.ok) {
        await fetchRenderedHistory();
        addToast({
          type: "success",
          text: `Đã đánh dấu thành công ${unrecordedVideos.length} video vào lịch sử render!`,
        });
        setStatusBanner({
          type: "success",
          text: `Đã ghi nhận ${unrecordedVideos.length} video tổ hợp vào lịch sử render mà không cần tải về máy.`,
        });
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast({
          type: "error",
          text: errData.error || "Không thể lưu lịch sử render. Vui lòng thử lại.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast({
        type: "error",
        text: `Lỗi: ${msg}`,
      });
    } finally {
      setIsMarkingAllRendered(false);
      setShowMarkAllRenderedModal(false);
    }
  };

  const handleConfirmDeleteHistoryItem = async () => {
    if (!historyItemPendingDelete?.id) return;
    const item = historyItemPendingDelete;
    setIsDeletingHistoryItem(true);
    try {
      const res = await authFetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_history_item", id: item.id }),
      });
      if (res.ok) {
        setRenderedHistoryList((prev) => prev.filter((r) => r.id !== item.id));
        if (selectedHistoryDetail?.id === item.id) {
          setSelectedHistoryDetail(null);
        }
        setProjectRenderedCount((prev) => Math.max(0, prev - 1));
        addToast({
          type: "success",
          text: `Đã xóa video "${item.name || item.id}" khỏi lịch sử render.`,
        });
        setHistoryItemPendingDelete(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        addToast({
          type: "error",
          text: errData.error || "Không thể xóa bản ghi video.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast({ type: "error", text: msg });
    } finally {
      setIsDeletingHistoryItem(false);
    }
  };

  const handleDeleteHistoryItem = async (id?: string) => {
    if (!id) return;
    const target = renderedHistoryList.find((r) => r.id === id);
    if (target) {
      setHistoryItemPendingDelete(target);
      return;
    }
    try {
      const res = await authFetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_history_item", id }),
      });
      if (res.ok) {
        setRenderedHistoryList((prev) => prev.filter((r) => r.id !== id));
        if (selectedHistoryDetail?.id === id) {
          setSelectedHistoryDetail(null);
        }
        setProjectRenderedCount((prev) => Math.max(0, prev - 1));
        setStatusBanner({
          type: "success",
          text: "Đã xóa bản ghi video khỏi lịch sử render.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    }
  };

  const handleToggleHistoryStatus = async (record: RenderedVideoRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canEditHistory) {
      notifyPermissionDenied("Bạn không có quyền chỉnh sửa trạng thái lịch sử render.");
      return;
    }
    const newStatus: "unused" | "used" = record.status === "used" ? "unused" : "used";

    // Optimistic UI update
    setRenderedHistoryList((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, status: newStatus } : r)),
    );
    if (selectedHistoryDetail?.id === record.id) {
      setSelectedHistoryDetail((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    try {
      const res = await authFetch("/api/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_render_status",
          id: record.id,
          status: newStatus,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Không thể cập nhật trạng thái");
      }
      setStatusBanner({
        type: "success",
        text: `Đã đánh dấu "${record.name || "Video"}" là ${
          newStatus === "used" ? "đã sử dụng" : "chưa sử dụng"
        }.`,
      });
    } catch (err: unknown) {
      setRenderedHistoryList((prev) =>
        prev.map((r) => (r.id === record.id ? { ...r, status: record.status } : r)),
      );
      if (selectedHistoryDetail?.id === record.id) {
        setSelectedHistoryDetail((prev) => (prev ? { ...prev, status: record.status } : null));
      }
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    }
  };

  const historyCounts = useMemo(() => {
    let unused = 0;
    let used = 0;
    for (const r of renderedHistoryList) {
      if (r.status === "used") used++;
      else unused++;
    }
    return { all: renderedHistoryList.length, unused, used };
  }, [renderedHistoryList]);

  const filteredHistoryList = useMemo(() => {
    let list = [...renderedHistoryList];

    if (historyFilterStatus === "unused") {
      list = list.filter((r) => r.status !== "used");
    } else if (historyFilterStatus === "used") {
      list = list.filter((r) => r.status === "used");
    }

    if (historySearchText.trim()) {
      const q = historySearchText.trim().toLowerCase();
      list = list.filter((r) => {
        const nameMatch = (r.name || "").toLowerCase().includes(q);
        const tupleMatch = (r.tupleKey || "").toLowerCase().includes(q);
        const comp = r.payload as ComposedVideo | undefined;
        const slotMatch = comp?.slots?.some((s) =>
          (s.shotLabel || s.shotId || "").toLowerCase().includes(q),
        );
        return nameMatch || tupleMatch || slotMatch;
      });
    }

    list.sort((a, b) => {
      const timeA = new Date(a.renderedAt).getTime() || 0;
      const timeB = new Date(b.renderedAt).getTime() || 0;
      return historySortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

    return list;
  }, [renderedHistoryList, historyFilterStatus, historySearchText, historySortOrder]);

  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistoryList.length / historyPageSize));

  const paginatedHistoryList = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistoryList.slice(start, start + historyPageSize);
  }, [filteredHistoryList, historyPage, historyPageSize]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistoryPage(1);
  }, [historyFilterStatus, historySearchText, historySortOrder, historyPageSize]);

  const getGoogleDriveLinkFromSlot = (slot?: ResolvedShotSlot | null): string => {
    if (!slot) return "";
    if (slot.localUrl?.startsWith("/api/drive-stream/")) {
      const fileId = slot.localUrl.replace("/api/drive-stream/", "").split("?")[0];
      if (fileId) return `https://drive.google.com/file/d/${fileId}/view`;
    }
    if (slot.shotId?.startsWith("drive_")) {
      const parts = slot.shotId.split("_");
      if (parts.length >= 3 && parts[2]) {
        return `https://drive.google.com/file/d/${parts[2]}/view`;
      }
    }
    if (
      slot.src &&
      (slot.src.includes("drive.google.com") || slot.src.includes("googleusercontent.com"))
    ) {
      return slot.src;
    }
    return "";
  };

  const getGoogleDriveLinkFromVoice = (voice?: MultiVoiceItem | null): string => {
    if (!voice) return "";
    if (voice.driveRawUrl) return voice.driveRawUrl;
    if (voice.driveFileId) {
      return `https://drive.google.com/file/d/${voice.driveFileId}/view`;
    }
    if (voice.localUrl?.startsWith("/api/drive-stream/")) {
      const fileId = voice.localUrl.replace("/api/drive-stream/", "").split("?")[0];
      if (fileId) return `https://drive.google.com/file/d/${fileId}/view`;
    }
    return "";
  };

  const handleExportHistory = (format: "xlsx" | "csv") => {
    setShowExportMenu(false);
    if (renderedHistoryList.length === 0) {
      setStatusBanner({
        type: "error",
        text: "Không có video nào trong lịch sử để xuất.",
      });
      return;
    }

    const rows = renderedHistoryList.map((rec, idx) => {
      const comp = rec.payload as ComposedVideo | undefined;
      const dateStr = rec.renderedAt
        ? new Date(rec.renderedAt).toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : "";

      const slotMap: Record<string, string> = {
        open: "",
        product: "",
        texture: "",
        apply: "",
        end: "",
      };

      if (comp?.slots) {
        for (const slot of comp.slots) {
          const driveLink = getGoogleDriveLinkFromSlot(slot);
          slotMap[slot.category] = driveLink || slot.shotLabel || slot.shotId || "";
        }
      }

      let voiceValue = "";
      if (comp?.voiceTrackId) {
        const v = multiVoices.find((m) => m.id === comp.voiceTrackId);
        voiceValue = getGoogleDriveLinkFromVoice(v) || v?.name || "Voice";
      }

      return {
        STT: idx + 1,
        Name: rec.name || `Video #${idx + 1}`,
        Duration: comp?.finalDuration ? `${comp.finalDuration.toFixed(1)}s` : "",
        Date: dateStr,
        Open: slotMap.open,
        Product: slotMap.product,
        Texture: slotMap.texture,
        Apply: slotMap.apply,
        End: slotMap.end,
        Voice: voiceValue,
        Status: rec.status === "used" ? "Đã sử dụng" : "Chưa sử dụng",
      };
    });

    const projectNameSafe = (currentProjectName || "OmniGen").replace(/\s+/g, "_");
    const fileName = `Lich_su_render_${projectNameSafe}_${new Date().toISOString().slice(0, 10)}`;

    if (format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [
        { wch: 6 }, // STT
        { wch: 25 }, // Name
        { wch: 12 }, // Duration
        { wch: 22 }, // Date
        { wch: 55 }, // Open
        { wch: 55 }, // Product
        { wch: 55 }, // Texture
        { wch: 55 }, // Apply
        { wch: 55 }, // End
        { wch: 55 }, // Voice
        { wch: 16 }, // Status
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Lịch sử render");
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
    } else {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    setStatusBanner({
      type: "success",
      text: `Đã xuất toàn bộ ${
        renderedHistoryList.length
      } video ra file ${format.toUpperCase()} thành công!`,
    });
  };

  const handlePreviewHistoryComposed = (rec: RenderedVideoRecord) => {
    if (!rec.payload) {
      setStatusBanner({
        type: "info",
        text: "Video này được render ở phiên bản cũ nên không có bản ghi chi tiết cảnh.",
      });
      return;
    }
    const comp = rec.payload as unknown as ComposedVideo;
    const exists = state.composedVideos.some((c) => c.id === comp.id);
    if (!exists) {
      setState((prev) => ({
        ...prev,
        composedVideos: [comp, ...prev.composedVideos],
      }));
    }
    setSelectedComposedId(comp.id);
    setMainTab("mix");
    setStatusBanner({
      type: "success",
      text: `Đang xem lại "${
        comp.name || rec.name || "Video đã render"
      }" trên màn hình preview 9:16.`,
    });
  };

  // Plan Combinatorial Mix
  const handlePlanDiverseMix = async () => {
    const missingCats = CATEGORY_ORDER.filter((c) => (categoryPools[c]?.length || 0) === 0);
    if (missingCats.length > 0) {
      setStatusBanner({
        type: "error",
        text: `Còn thiếu video ở các Category: ${missingCats
          .map((c) => c.toUpperCase())
          .join(", ")}. Hãy upload đủ 5 Category để bắt đầu trộn!`,
      });
      return;
    }

    setBusyMessage("Đang tính toán các tổ hợp đa dạng tối ưu (Hamming distance, Speed Scale)...");
    setStatusBanner(null);
    const clampedMixCount = Math.max(1, Math.min(50, targetMixCount || 10));
    const effectivePrefix =
      (clipNamePrefix || "").trim() || currentProjectName.trim() || "Video Remix";
    persistProjectSettings({ clipNamePrefix: effectivePrefix });

    try {
      const res = await fetch("/api/plan-mix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          sessionId,
          projectId: projectId || undefined,
          clipNamePrefix: effectivePrefix,
          categoryPools,
          multiVoiceTracks: multiVoices,
          mixVoiceMode,
          diversityConfig: {
            targetCount: clampedMixCount,
            minHammingDistance: 2,
            maxShotFrequency: Math.max(2, Math.ceil(clampedMixCount / 3)),
            seed: Date.now(),
            enableAutoVariantEdits: false,
            randomTransitionDuration: 0,
          },
          preserveOriginalClips: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi khi tạo tổ hợp");

      setState((prev) => ({
        ...prev,
        composedVideos: data.composedVideos,
      }));
      if (data.composedVideos?.length > 0) {
        setSelectedComposedId(data.composedVideos[0].id);
        setEditingSlotCategory(null);
        setActiveSlotFocusIndex(0);
      }
      setStatusBanner({
        type: "success",
        text: `Đã tạo thành công ${data.totalComposed} tổ hợp video! Bạn có thể click vào từng cảnh (OPEN, PRODUCT...) để chỉnh tốc độ, cắt bớt giây và lật gương.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setBusyMessage(null);
    }
  };

  // Inline scene slot editor within a composed video
  const handleUpdateComposedSlot = (
    composedId: string,
    slotIndex: number,
    edits: Partial<ResolvedShotSlot>,
  ) => {
    if (!state) return;
    const targetComp = state.composedVideos.find((c) => c.id === composedId);
    if (!targetComp) return;

    let currentVoice: VoiceTrack | null = null;
    if (targetComp.voiceTrackId) {
      const foundMulti = state.multiVoiceTracks?.find((v) => v.id === targetComp.voiceTrackId);
      if (foundMulti) {
        currentVoice = {
          id: foundMulti.id,
          name: foundMulti.name,
          fileName: foundMulti.fileName,
          localUrl: foundMulti.localUrl,
          localPath: foundMulti.localPath || "",
          sizeBytes: 0,
          duration: foundMulti.duration || 20,
          createdAt: "",
        };
      } else if (state.voiceTrack?.id === targetComp.voiceTrackId) {
        currentVoice = state.voiceTrack;
      }
    }

    const updatedComp = recalculateComposedVideo(
      targetComp,
      slotIndex,
      edits,
      currentVoice,
      state.syncMode,
    );

    const updatedList = state.composedVideos.map((c) => (c.id === composedId ? updatedComp : c));

    persistState({
      ...state,
      composedVideos: updatedList,
    });
  };

  const handleChangeComposedVoice = (composedId: string, voiceId: string | null) => {
    if (!state) return;
    const targetComp = state.composedVideos.find((c) => c.id === composedId);
    if (!targetComp) return;

    let chosenVoice: VoiceTrack | null = null;
    if (voiceId) {
      const found = multiVoices.find((v) => v.id === voiceId);
      if (found) {
        chosenVoice = {
          id: found.id,
          name: found.name,
          fileName: found.fileName,
          localUrl: found.localUrl,
          localPath: found.localPath || "",
          sizeBytes: 0,
          duration: found.duration || 20,
          createdAt: "",
        };
      }
    }

    const updatedComp = recalculateComposedVideo(targetComp, -1, {}, chosenVoice, state.syncMode);
    updatedComp.voiceTrackId = voiceId;

    const updatedList = state.composedVideos.map((c) => (c.id === composedId ? updatedComp : c));

    persistState({
      ...state,
      composedVideos: updatedList,
    });
  };

  // Direct FFmpeg Render Single Composed Video
  const handleRenderSingleComposed = async (composed: ComposedVideo) => {
    setBusyMessage(`Đang xuất file MP4 hoàn chỉnh cho ${composed.name}...`);
    try {
      const res = await fetch("/api/render-composed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          videos: [composed],
          multiVoiceTracks: multiVoices,
          sessionId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${composed.name}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      // Ghi nhận lịch sử render vào dự án
      if (projectId) {
        fetch("/api/project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "record_render",
            projectId,
            records: [
              {
                tupleKey: composed.tupleKey,
                name: composed.name,
                payload: composed,
              },
            ],
          }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res.addedCount || res.count) {
              setProjectRenderedCount((prev) => prev + 1);
            }
          })
          .catch(() => {});
      }

      setStatusBanner({
        type: "success",
        text: `Đã xuất thành công ${composed.name}.mp4!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      setBusyMessage(null);
    }
  };

  // Direct FFmpeg Render All Composed Videos (ZIP download)
  const handleRenderAllComposedZip = async () => {
    if (!state?.composedVideos || state.composedVideos.length === 0) {
      setStatusBanner({ type: "error", text: "Chưa có tổ hợp nào để xuất." });
      return;
    }
    const totalCount = state.composedVideos.length;
    setIsRenderingBatch(true);
    setRenderProgress({
      current: 0,
      total: totalCount,
      name: "Đang khởi tạo FFmpeg...",
      percent: 0,
    });
    setBusyMessage(`Đang kết xuất ${totalCount} video MP4 và đóng gói ZIP...`);

    let pollInterval: NodeJS.Timeout | null = null;
    try {
      pollInterval = setInterval(async () => {
        try {
          const pRes = await fetch(
            `/api/render-progress?sessionId=${encodeURIComponent(sessionId)}`,
          );
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData.active && pData.total > 0) {
              setRenderProgress({
                current: pData.current,
                total: pData.total,
                name: pData.current_name || "",
                percent: pData.percent,
              });
            }
          }
        } catch {
          // Ignore transient polling errors
        }
      }, 700);

      const res = await fetch("/api/render-composed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          videos: state.composedVideos,
          multiVoiceTracks: multiVoices,
          sessionId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `lachvid_rendered_${sessionId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      // Ghi nhận lịch sử render vào dự án khi tải ZIP thành công
      if (projectId) {
        const records = state.composedVideos.map((comp) => ({
          tupleKey: comp.tupleKey,
          name: comp.name,
          payload: comp,
        }));
        fetch("/api/project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "record_render",
            projectId,
            records,
          }),
        })
          .then((r) => r.json())
          .then((res) => {
            if (res.addedCount || res.count) {
              setProjectRenderedCount((prev) => prev + records.length);
            }
          })
          .catch(() => {});
      }

      setStatusBanner({
        type: "success",
        text: `Đã render thành công toàn bộ ${totalCount} video MP4 chuẩn và tải về ZIP!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusBanner({ type: "error", text: msg });
    } finally {
      if (pollInterval) clearInterval(pollInterval);
      setRenderProgress(null);
      setIsRenderingBatch(false);
      setBusyMessage(null);
    }
  };

  return (
    <ProjectAccessProvider access={accessState} onPermissionDenied={notifyPermissionDenied}>
      <div className="flex min-h-screen bg-slate-950 font-sans text-slate-100">
        <GlobalSidebar
          mainTab={mainTab}
          onSelectTab={setMainTab}
          isExpanded={isSidebarExpanded}
          onToggleExpand={handleToggleSidebar}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          canViewSplit={canViewSplit}
          canViewMix={canViewMix}
          canViewHistory={canViewHistory}
          projectRenderedCount={projectRenderedCount}
          onHistoryClick={fetchRenderedHistory}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top Header with Breadcrumbs & Quick Actions */}
          <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 px-4 py-3 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              {/* Mobile Drawer Trigger Button */}
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="shrink-0 rounded-xl bg-slate-800/90 p-2 text-slate-200 transition hover:bg-slate-700 hover:text-white md:hidden"
                title="Mở menu điều hướng"
                aria-label="Mở menu điều hướng"
              >
                <Menu className="h-4 w-4" />
              </button>
              {/* Breadcrumb Navigation: Dự án > Folder Switcher */}
              <div className="flex min-w-0 items-center gap-1.5 text-xs sm:gap-2">
                <Link
                  href="/"
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-slate-300 transition hover:border-slate-700 hover:text-white"
                  title="Danh sách dự án"
                >
                  <ArrowLeft className="h-3 w-3 sm:hidden" />
                  <span className="hidden sm:inline">Dự án</span>
                </Link>
                <ChevronRight className="h-3 w-3 shrink-0 text-slate-600" />
                {parentProjectIdState ? (
                  <Link
                    href={`/projects/${parentProjectIdState}`}
                    className="max-w-[110px] truncate rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 font-medium text-slate-300 transition hover:border-slate-700 hover:text-white sm:max-w-[180px]"
                    title={`Về dự án: ${parentProjectNameState || "Dự án"}`}
                  >
                    {parentProjectNameState || "Dự án"}
                  </Link>
                ) : (
                  <span className="max-w-[110px] truncate rounded-xl bg-slate-900/40 px-2.5 py-1.5 font-medium text-slate-400 sm:max-w-[180px]">
                    {parentProjectNameState || "Dự án"}
                  </span>
                )}
                <ChevronRight className="h-3 w-3 shrink-0 text-slate-600" />
                {/* Folder Dropdown Quick Switcher */}
                <div className="relative" ref={folderSwitcherRef}>
                  <button
                    type="button"
                    onClick={() => setShowFolderSwitcher((prev) => !prev)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 font-semibold text-white transition hover:border-indigo-500/60"
                    title="Bấm để chuyển nhanh giữa các folder"
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    <span className="max-w-[120px] truncate sm:max-w-[200px]">
                      {currentProjectName || "Folder"}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-indigo-400 transition-transform duration-200 ${
                        showFolderSwitcher ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {/* Dropdown Menu */}
                  {showFolderSwitcher && (
                    <div className="animate-in fade-in zoom-in-95 absolute left-0 z-50 mt-1.5 w-64 rounded-xl border border-slate-800 bg-slate-900 py-1 shadow-2xl duration-150">
                      <div className="border-b border-slate-800 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                        Các folder trong dự án
                      </div>
                      <div className="max-h-56 divide-y divide-slate-800/40 overflow-y-auto py-1">
                        {siblingFolders.length > 0 ? (
                          siblingFolders.map((f) => {
                            const isCurrent = f.id === projectId;
                            return (
                              <Link
                                key={f.id}
                                href={`/projects/${parentProjectIdState || "default"}/folders/${f.id}`}
                                onClick={() => setShowFolderSwitcher(false)}
                                className={`flex items-center justify-between px-3 py-2 text-xs transition ${
                                  isCurrent
                                    ? "bg-indigo-600/15 font-bold text-indigo-300"
                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                }`}
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <FolderOpen
                                    className={`h-3.5 w-3.5 shrink-0 ${
                                      isCurrent ? "text-indigo-400" : "text-slate-500"
                                    }`}
                                  />
                                  <span className="truncate">{f.name}</span>
                                </div>
                                {isCurrent && (
                                  <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                                )}
                              </Link>
                            );
                          })
                        ) : (
                          <div className="px-3 py-2 text-xs text-slate-500 italic">
                            Chỉ có 1 folder hiện tại
                          </div>
                        )}
                      </div>
                      {parentProjectIdState && (
                        <div className="border-t border-slate-800 bg-slate-950/40 p-1.5">
                          <Link
                            href={`/projects/${parentProjectIdState}`}
                            onClick={() => setShowFolderSwitcher(false)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-800/70 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                          >
                            <Layers className="h-3 w-3 text-indigo-400" />
                            <span>Quản lý tất cả folder</span>
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {projectRenderedCount > 0 && canViewHistory && (
                  <button
                    type="button"
                    onClick={() => {
                      setMainTab("history");
                      fetchRenderedHistory();
                    }}
                    className="hidden shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-indigo-800/60 bg-indigo-950/60 px-2.5 py-1 font-mono text-[11px] text-indigo-300 transition hover:bg-indigo-900/80 hover:text-white lg:flex"
                    title="Bấm để xem lịch sử video đã render"
                  >
                    <History className="h-3 w-3 text-indigo-400" />
                    <span>Đã render {projectRenderedCount} video</span>
                  </button>
                )}
                {!accessState?.isOwner && accessState?.owner && (
                  <span className="hidden items-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300 xl:inline-flex">
                    Được chia sẻ bởi {accessState.owner.name || accessState.owner.email}
                  </span>
                )}
              </div>
            </div>
            {/* Share & User Avatar */}
            <div className="flex shrink-0 items-center gap-2.5">
              {accessState?.isOwner && parentProjectIdState && (
                <button
                  type="button"
                  onClick={() => setShowShareModal(true)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-800 bg-slate-900 text-indigo-400 transition hover:border-indigo-500/40 hover:bg-slate-800 hover:text-indigo-300"
                  title="Chia sẻ dự án"
                  aria-label="Chia sẻ dự án"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              )}
              <UserAvatarMenu showProjectsShortcut={true} />
            </div>
          </header>

          {/* Hidden Master File Pickers */}
          <input
            ref={singleVideoInputRef}
            type="file"
            accept="video/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.mkv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleUploadSingleSource(e.target.files[0]);
              e.target.value = "";
            }}
          />
          <input
            ref={masterFolderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleMasterFolderUpload}
          />
          {CATEGORY_ORDER.map((c) => (
            <input
              key={`col_input_${c}`}
              ref={(el) => {
                categoryInputRefs.current[c] = el;
              }}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              multiple
              className="hidden"
              onChange={(e) => handleCategoryColumnUpload(c, e.target.files)}
            />
          ))}
          <input
            ref={voiceInputRef}
            type="file"
            accept="audio/mp3,audio/wav,audio/m4a,audio/mpeg"
            multiple
            className="hidden"
            onChange={(e) => handleVoiceUpload(e.target.files)}
          />

          <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 transition-all duration-300 sm:p-6">
            {/* ======================================================== */}
            {/* TAB 1: TÁCH 1 VIDEO & SLICER STUDIO (CHỈNH GIÂY + PREVIEW) */}
            {/* ======================================================== */}
            {mainTab === "split" && (
              <div className="space-y-6">
                {/* Top Control Card: Upload 1 video & Min Giây */}
                <div className="grid grid-cols-1 gap-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:grid-cols-12">
                  {/* Left: Upload Single Video Source */}
                  <div className="space-y-3 lg:col-span-5">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-sm font-bold">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/20 text-xs text-rose-300">
                          1
                        </span>
                        <span>Upload 1 video gốc để tách</span>
                      </h2>
                      {state?.sourceVideo && (
                        <button
                          onClick={handleNextVideo}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Làm video mới</span>
                        </button>
                      )}
                    </div>

                    {!state?.sourceVideo ? (
                      canEditSplit ? (
                        <div
                          onClick={() => singleVideoInputRef.current?.click()}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.dataTransfer.files?.[0]) {
                              handleUploadSingleSource(e.dataTransfer.files[0]);
                            }
                          }}
                          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/40 p-6 text-center transition hover:border-rose-500 hover:bg-slate-950/70"
                        >
                          <Upload className="mb-2 h-7 w-7 animate-bounce text-rose-400" />
                          <p className="text-xs font-semibold text-white">
                            Chọn hoặc kéo thả 1 video gốc vào đây
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            MP4, MOV, WebM (Khuyên dùng video dọc 9:16)
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/40 p-6 text-center text-xs text-slate-500">
                          Chưa có video gốc và bạn không có quyền tải lên video.
                        </div>
                      )
                    ) : (
                      <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="max-w-[200px] truncate font-bold text-white">
                            {state.sourceVideo.name}
                          </span>
                          <span className="font-mono text-emerald-400">
                            {state.sourceVideo.duration.toFixed(1)}s
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <span>{(state.sourceVideo.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
                            <span>•</span>
                            <span>
                              {state.sourceVideo.width}x{state.sourceVideo.height}
                            </span>
                          </div>
                          <PermissionGate module="split" action="edit">
                            <button
                              onClick={() => singleVideoInputRef.current?.click()}
                              className="inline-flex items-center gap-1 rounded bg-rose-500/20 px-2 py-0.5 text-[11px] text-rose-300 transition hover:bg-rose-500/30"
                            >
                              <Upload className="h-3 w-3" />
                              <span>Đổi video khác</span>
                            </button>
                          </PermissionGate>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Min Giây per Category & Auto Detect */}
                  <div className="space-y-3 lg:col-span-7">
                    <h2 className="flex items-center gap-2 text-sm font-bold">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/20 text-xs text-rose-300">
                        2
                      </span>
                      <span>Cài đặt số giây tối thiểu (min giây) cho 5 category</span>
                    </h2>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {SHOT_CATEGORIES.map((cat) => {
                        const currentMin = categoryMinDurations[cat.id];
                        return (
                          <div
                            key={cat.id}
                            className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950 p-2.5"
                          >
                            <span
                              className={`mb-1 self-start rounded-full border px-2 py-0.5 text-[10px] font-bold ${cat.badgeClass}`}
                            >
                              {cat.label}
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                max="30.0"
                                disabled={!canEditSplit}
                                value={currentMin}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 1.0;
                                  const updatedMinDurs = {
                                    ...categoryMinDurations,
                                    [cat.id]: val,
                                  };
                                  if (state) {
                                    const updatedShots = state.shots.map((s) =>
                                      applyMinDurationToShot(s, updatedMinDurs),
                                    );
                                    persistState({
                                      ...state,
                                      shots: updatedShots,
                                      categoryMinDurations: updatedMinDurs,
                                    });
                                  }
                                }}
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center font-mono text-xs text-white focus:border-rose-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <span className="text-xs text-slate-400">s</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <label className="flex items-center gap-1">
                          <span>Thuật toán:</span>
                          <select
                            disabled={!canEditSplit}
                            value={pyDetector}
                            onChange={(e) =>
                              setPyDetector(e.target.value as "content" | "adaptive")
                            }
                            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-0.5 text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="content">Content</option>
                            <option value="adaptive">Adaptive</option>
                          </select>
                        </label>
                        <label className="flex items-center gap-1">
                          <span>Threshold:</span>
                          <input
                            type="number"
                            disabled={!canEditSplit}
                            value={pyThreshold}
                            onChange={(e) => setPyThreshold(Number(e.target.value))}
                            className="w-12 rounded-lg border border-slate-800 bg-slate-950 px-1 py-0.5 text-center font-mono text-xs text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </label>
                      </div>

                      <PermissionGate module="split" action="edit">
                        <button
                          onClick={handleRunPySceneDetect}
                          disabled={!state?.sourceVideo}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-500/20 transition disabled:pointer-events-none disabled:opacity-50"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          <span>Auto detect cắt scene</span>
                        </button>
                      </PermissionGate>
                    </div>
                  </div>
                </div>

                {/* Category Statistics Summary Bar & Hotkeys Helper */}
                {state?.shots && state.shots.length > 0 && (
                  <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <h3 className="flex items-center gap-2 text-xs font-bold tracking-wider text-white uppercase">
                          <Layers className="h-4 w-4 text-rose-400" />
                          <span>Thống kê 5 nhóm cảnh cắt:</span>
                        </h3>
                        <div className="flex items-center gap-1.5">
                          {SHOT_CATEGORIES.map((c) => {
                            const cnt = categoryStats.counts[c.id];
                            return (
                              <span
                                key={c.id}
                                className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${
                                  cnt > 0
                                    ? c.badgeClass
                                    : "border-slate-800 bg-slate-950 text-slate-600"
                                }`}
                              >
                                {c.id.slice(0, 3).toUpperCase()}: {cnt}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hotkeys helper pill */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <span>Phím tắt:</span>
                        <span className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-slate-200">
                          1–5
                        </span>{" "}
                        gán Category •{" "}
                        <span className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-slate-200">
                          S
                        </span>{" "}
                        Tách đôi •{" "}
                        <span className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-slate-200">
                          M
                        </span>{" "}
                        Mirror •{" "}
                        <span className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-slate-200">
                          L
                        </span>{" "}
                        Khoá chữ •{" "}
                        <span className="rounded border border-slate-800 bg-slate-950 px-1.5 py-0.5 font-mono text-slate-200">
                          Space
                        </span>{" "}
                        Play/Dừng
                      </div>
                    </div>
                  </div>
                )}

                {/* FULL SLICER STUDIO WORKSPACE (GRID + 100% WIDTH EXPORT CARD) */}
                {state?.shots && state.shots.length > 0 && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                      {/* ======================================================== */}
                      {/* LEFT COLUMN (7/12): 5 CATEGORY CARDS + INLINE INSPECTOR */}
                      {/* ======================================================== */}
                      <div className="space-y-4 lg:col-span-7">
                        {/* 5 Category Cards Header & Action */}
                        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-indigo-400" />
                              <h3 className="text-sm font-bold text-white">
                                Kho video theo 5 category (đã tách từ video gốc)
                              </h3>
                            </div>
                            <PermissionGate module="split" action="edit">
                              <button
                                onClick={() => {
                                  const lastEnd = state.shots[state.shots.length - 1]?.end || 0;
                                  const maxDur = state.sourceVideo?.duration || 30;
                                  const newBegin =
                                    lastEnd < maxDur - 1 ? lastEnd : Math.max(0, maxDur - 4);
                                  const newEnd =
                                    Math.round(Math.min(maxDur, newBegin + 4) * 10) / 10;
                                  const catToAssign = splitEditingCategory || "product";
                                  const newShot: Shot = {
                                    id: `shot_${Date.now()}`,
                                    sourceVideoId: state.sourceVideo?.id || "src_vid",
                                    label: `Cảnh #${state.shots.length + 1}`,
                                    begin: Math.round(newBegin * 10) / 10,
                                    end: newEnd,
                                    rawBegin: Math.round(newBegin * 10) / 10,
                                    rawEnd: newEnd,
                                    category: catToAssign,
                                    edits: {
                                      flipH: false,
                                      lockFlipH: false,
                                      speed: 1,
                                      zoom: false,
                                    },
                                  };
                                  persistState({
                                    ...state,
                                    shots: [...state.shots, newShot],
                                  });
                                  handleSelectSplitShot(newShot);
                                  setSplitEditingCategory(catToAssign);
                                  setAccordionShotId(newShot.id);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                              >
                                <Plus className="h-3.5 w-3.5 text-indigo-400" />
                                <span>Thêm shot thủ công</span>
                              </button>
                            </PermissionGate>
                          </div>

                          {/* 5 Slots Badges / Category Cards */}
                          <div className="grid grid-cols-5 gap-1.5">
                            {SHOT_CATEGORIES.map((cat) => {
                              const catShots = state.shots.filter((s) => s.category === cat.id);
                              const isCatActive = splitEditingCategory === cat.id;
                              const minDur = categoryMinDurations[cat.id] ?? 3.0;
                              const totalDur = catShots.reduce(
                                (acc, s) => acc + (s.end - s.begin) / (s.edits.speed || 1),
                                0,
                              );

                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => {
                                    if (isCatActive) {
                                      setSplitEditingCategory(null);
                                      setAccordionShotId(null);
                                    } else {
                                      setSplitEditingCategory(cat.id);
                                      setAccordionShotId(null);
                                      const currentCatShots = state.shots.filter(
                                        (s) => s.category === cat.id,
                                      );
                                      if (currentCatShots.length > 0) {
                                        handleSelectSplitShot(currentCatShots[0]);
                                      }
                                    }
                                  }}
                                  className={`flex cursor-pointer flex-col justify-between rounded-xl border p-2 text-left text-[10px] transition ${
                                    isCatActive
                                      ? "border-indigo-500 bg-indigo-950/70 shadow-md ring-2 shadow-indigo-500/20 ring-indigo-500/50"
                                      : "border-slate-800 bg-slate-950/80 hover:border-slate-700"
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center justify-between font-bold text-slate-200 uppercase">
                                      <span
                                        className={
                                          isCatActive ? "font-extrabold text-indigo-300" : ""
                                        }
                                      >
                                        {cat.id}
                                      </span>
                                      <span
                                        className={`font-mono font-bold ${
                                          isCatActive ? "text-indigo-300" : "text-slate-300"
                                        }`}
                                      >
                                        {catShots.length > 0 ? `${totalDur.toFixed(1)}s` : "0s"}
                                      </span>
                                    </div>
                                    <div className="mt-1 truncate text-[9px] font-medium text-slate-400">
                                      {catShots.length > 0 ? `${catShots.length} cảnh` : "Chưa có"}
                                    </div>
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between border-t border-slate-800/80 pt-1 font-mono text-[9px] text-slate-500">
                                    <span>≥ {minDur}s</span>
                                    <span
                                      className={
                                        catShots.length > 0
                                          ? "font-bold text-emerald-400"
                                          : "text-slate-600"
                                      }
                                    >
                                      {catShots.length > 0 ? "✓ Sẵn sàng" : "Trống"}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Inline Scene Inspector / Accordion View */}
                          {splitEditingCategory && (
                            <div className="animate-in fade-in mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-3.5 duration-200">
                              {splitCatShots.length === 0 ? (
                                /* EMPTY STATE */
                                <div className="space-y-2 py-6 text-center">
                                  <p className="text-xs text-slate-400">
                                    Chưa có cảnh nào được gán cho nhóm{" "}
                                    <span className="font-bold text-indigo-400 uppercase">
                                      {splitEditingCategory}
                                    </span>
                                    .
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const maxDur = state.sourceVideo?.duration || 30;
                                      const newShot: Shot = {
                                        id: `shot_${Date.now()}`,
                                        sourceVideoId: state.sourceVideo?.id || "src_vid",
                                        label: `Cảnh ${splitEditingCategory.toUpperCase()}`,
                                        begin: 0,
                                        end: Math.min(
                                          maxDur,
                                          categoryMinDurations[splitEditingCategory] || 4,
                                        ),
                                        rawBegin: 0,
                                        rawEnd: Math.min(
                                          maxDur,
                                          categoryMinDurations[splitEditingCategory] || 4,
                                        ),
                                        category: splitEditingCategory,
                                        edits: {
                                          flipH: false,
                                          lockFlipH: false,
                                          speed: 1,
                                          zoom: false,
                                        },
                                      };
                                      persistState({
                                        ...state,
                                        shots: [...state.shots, newShot],
                                      });
                                      handleSelectSplitShot(newShot);
                                      setAccordionShotId(newShot.id);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>+ Tạo cảnh mới cho {splitEditingCategory}</span>
                                  </button>
                                </div>
                              ) : (
                                /* LIST OF SHOT CARDS WITH ACCORDIONS */
                                <div className="space-y-3">
                                  {/* List Header Bar */}
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-md border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-300 uppercase">
                                        Nhóm {splitEditingCategory}
                                      </span>
                                      <span className="text-xs font-semibold text-slate-300">
                                        Danh sách {splitCatShots.length} cảnh
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const lastEnd =
                                            state.shots[state.shots.length - 1]?.end || 0;
                                          const maxDur = state.sourceVideo?.duration || 30;
                                          const newBegin =
                                            lastEnd < maxDur - 1
                                              ? lastEnd
                                              : Math.max(0, maxDur - 4);
                                          const newEnd =
                                            Math.round(Math.min(maxDur, newBegin + 4) * 10) / 10;
                                          const newShot: Shot = {
                                            id: `shot_${Date.now()}`,
                                            sourceVideoId: state.sourceVideo?.id || "src_vid",
                                            label: `Cảnh ${splitEditingCategory.toUpperCase()} #${
                                              splitCatShots.length + 1
                                            }`,
                                            begin: Math.round(newBegin * 10) / 10,
                                            end: newEnd,
                                            rawBegin: Math.round(newBegin * 10) / 10,
                                            rawEnd: newEnd,
                                            category: splitEditingCategory,
                                            edits: {
                                              flipH: false,
                                              lockFlipH: false,
                                              speed: 1,
                                              zoom: false,
                                            },
                                          };
                                          persistState({
                                            ...state,
                                            shots: [...state.shots, newShot],
                                          });
                                          handleSelectSplitShot(newShot);
                                          setAccordionShotId(newShot.id);
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
                                      >
                                        <Plus className="h-3 w-3" />
                                        <span>Thêm cảnh</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSplitEditingCategory(null);
                                          setAccordionShotId(null);
                                        }}
                                        className="rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:border-indigo-500/30 hover:bg-indigo-500/20 hover:text-indigo-300"
                                        title="Thu gọn bảng"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Scrollable list of cards */}
                                  <div className="max-h-[550px] space-y-2.5 overflow-y-auto pr-1">
                                    {splitCatShots.map((shot, sIdx) => {
                                      const isSelected = shot.id === selectedShotId;
                                      const isAccordionOpen = shot.id === accordionShotId;
                                      const rawDur = shot.end - shot.begin;
                                      const speed = shot.edits.speed || 1.0;
                                      const effectiveDur = (rawDur / speed).toFixed(1);
                                      const minDur =
                                        categoryMinDurations[splitEditingCategory] ?? 3.0;
                                      const isSlowMo = speed < 0.999;

                                      return (
                                        <div key={shot.id} className="space-y-2">
                                          {/* Shot Card Header / Row */}
                                          <div
                                            onClick={() => {
                                              handleSelectSplitShot(shot);
                                            }}
                                            className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition select-none ${
                                              isSelected
                                                ? "border-indigo-500/80 bg-slate-900 shadow-md ring-1 shadow-indigo-500/10 ring-indigo-500/40"
                                                : "border-slate-800 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900/60"
                                            }`}
                                          >
                                            {/* Left: Index, Label, Timestamps, Badges */}
                                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                              <span
                                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border font-mono text-xs font-bold ${
                                                  isSelected
                                                    ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-300"
                                                    : "border-slate-700 bg-slate-900 text-slate-300"
                                                }`}
                                              >
                                                #{sIdx + 1}
                                              </span>
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="truncate text-xs font-bold text-white">
                                                    {shot.label}
                                                  </span>
                                                  {shot.edits.flipH && (
                                                    <span className="py-0.2 rounded border border-fuchsia-500/30 bg-fuchsia-500/20 px-1.5 text-[9px] font-semibold text-fuchsia-300">
                                                      Lật gương
                                                    </span>
                                                  )}
                                                  {isSlowMo && (
                                                    <span className="py-0.2 rounded border border-cyan-500/30 bg-cyan-500/20 px-1.5 font-mono text-[9px] text-cyan-300">
                                                      {speed}x
                                                    </span>
                                                  )}
                                                </div>
                                                <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-slate-400">
                                                  <span>
                                                    {shot.begin.toFixed(1)}s → {shot.end.toFixed(1)}
                                                    s
                                                  </span>
                                                  <span>•</span>
                                                  <span
                                                    className={`font-bold ${
                                                      parseFloat(effectiveDur) >= minDur
                                                        ? "text-emerald-400"
                                                        : "text-amber-400"
                                                    }`}
                                                  >
                                                    ⏱️ {effectiveDur}s
                                                  </span>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Right: Chỉnh sửa & Xoá buttons */}
                                            <div
                                              className="flex shrink-0 items-center gap-1.5"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  handleSelectSplitShot(shot);
                                                  setAccordionShotId((prev) =>
                                                    prev === shot.id ? null : shot.id,
                                                  );
                                                }}
                                                className={`rounded-lg p-1.5 transition ${
                                                  isAccordionOpen
                                                    ? "border border-indigo-500/40 bg-indigo-500/20 text-indigo-300"
                                                    : "text-slate-400 hover:bg-slate-800 hover:text-indigo-300"
                                                }`}
                                                title={
                                                  isAccordionOpen
                                                    ? "Đóng chỉnh sửa"
                                                    : "Chỉnh sửa cảnh này"
                                                }
                                              >
                                                <Edit3 className="h-3.5 w-3.5" />
                                              </button>

                                              <PermissionGate module="split" action="edit">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    handleDeleteShot(shot.id);
                                                    if (accordionShotId === shot.id) {
                                                      setAccordionShotId(null);
                                                    }
                                                  }}
                                                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-rose-400"
                                                  title="Xoá cảnh này"
                                                >
                                                  <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                              </PermissionGate>
                                            </div>
                                          </div>

                                          {/* Accordion Settings Panel */}
                                          {isAccordionOpen &&
                                            splitShotTrimInfo &&
                                            accordionShot &&
                                            accordionShot.id === shot.id && (
                                              <div className="animate-in fade-in space-y-3 pt-2 duration-200">
                                                {/* Header: Title, Mirror toggle, Play, Close X */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                                    <span className="shrink-0 rounded-md border border-indigo-500/30 bg-indigo-500/20 px-2 py-0.5 text-xs font-bold text-indigo-300 uppercase">
                                                      Cảnh {splitEditingCategory}
                                                    </span>
                                                    <input
                                                      type="text"
                                                      disabled={!canEditSplit}
                                                      value={accordionShot.label}
                                                      onChange={(e) => {
                                                        const updated = state.shots.map((s) =>
                                                          s.id === accordionShot.id
                                                            ? {
                                                                ...s,
                                                                label: e.target.value,
                                                              }
                                                            : s,
                                                        );
                                                        persistState({
                                                          ...state,
                                                          shots: updated,
                                                        });
                                                      }}
                                                      className="min-w-[120px] flex-1 truncate border-b border-transparent bg-transparent text-xs font-bold text-slate-100 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                                      title={
                                                        canEditSplit
                                                          ? "Click để đổi tên cảnh"
                                                          : "Chế độ chỉ xem"
                                                      }
                                                    />
                                                    <span className="hidden shrink-0 font-mono text-[10px] text-slate-400 md:inline">
                                                      (Gốc:{" "}
                                                      {splitShotTrimInfo.rawDuration.toFixed(1)}
                                                      s)
                                                    </span>
                                                  </div>

                                                  <div className="flex shrink-0 items-center gap-2">
                                                    {/* Mirror toggle button */}
                                                    <PermissionGate module="split" action="edit">
                                                      <button
                                                        type="button"
                                                        disabled={!canEditSplit}
                                                        onClick={() =>
                                                          handleToggleFlipH(accordionShot.id)
                                                        }
                                                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${
                                                          accordionShot.edits.flipH
                                                            ? "border-indigo-500/60 bg-indigo-600/30 text-indigo-300 shadow-sm"
                                                            : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                        }`}
                                                        title={
                                                          accordionShot.edits.flipH
                                                            ? "Đang lật gương"
                                                            : "Lật gương ngang hình ảnh (Mirror)"
                                                        }
                                                      >
                                                        <FlipHorizontal className="h-3.5 w-3.5" />
                                                        <span>
                                                          {accordionShot.edits.flipH
                                                            ? "Đang lật gương"
                                                            : "Lật gương"}
                                                        </span>
                                                      </button>
                                                    </PermissionGate>

                                                    {/* Xem đoạn này button */}
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        handlePlayActiveShot(accordionShot)
                                                      }
                                                      className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-[10px] text-slate-200 transition hover:bg-slate-700"
                                                      title="Phát thử đoạn video này trên player"
                                                    >
                                                      <Play className="h-3 w-3 fill-current text-indigo-400" />
                                                      <span>Xem đoạn này</span>
                                                    </button>

                                                    {/* Close Accordion Button */}
                                                    <button
                                                      type="button"
                                                      onClick={() => setAccordionShotId(null)}
                                                      className="rounded-md p-1 text-slate-400 transition hover:bg-indigo-500/20 hover:text-indigo-300"
                                                      title="Đóng bảng chỉnh sửa"
                                                    >
                                                      <X className="h-3.5 w-3.5" />
                                                    </button>
                                                  </div>
                                                </div>

                                                {/* 3-Column Grid: Speed Controls (1 col) + Apple Trimmer (2 cols) */}
                                                <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
                                                  {/* Speed Controls */}
                                                  <div className="flex flex-col justify-between space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                                                    <div>
                                                      <label className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-300">
                                                        <span>Tốc độ phát:</span>
                                                        <span className="font-mono font-bold text-indigo-400">
                                                          {splitShotTrimInfo.speed}x
                                                        </span>
                                                      </label>
                                                      <div className="mb-2 flex flex-wrap items-center gap-1">
                                                        {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(
                                                          (spd) => (
                                                            <button
                                                              key={spd}
                                                              type="button"
                                                              disabled={!canEditSplit}
                                                              onClick={() =>
                                                                handleUpdateShotEdits(
                                                                  accordionShot.id,
                                                                  {
                                                                    speed: spd,
                                                                  },
                                                                )
                                                              }
                                                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                                                                splitShotTrimInfo.speed === spd
                                                                  ? "bg-indigo-600 font-bold text-white"
                                                                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                                              } disabled:cursor-not-allowed disabled:opacity-50`}
                                                            >
                                                              {spd}x
                                                            </button>
                                                          ),
                                                        )}
                                                      </div>
                                                      <input
                                                        type="range"
                                                        min="0.25"
                                                        max="3.0"
                                                        step="0.05"
                                                        disabled={!canEditSplit}
                                                        value={splitShotTrimInfo.speed}
                                                        onChange={(e) =>
                                                          handleUpdateShotEdits(accordionShot.id, {
                                                            speed:
                                                              parseFloat(e.target.value) || 1.0,
                                                          })
                                                        }
                                                        className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                      />
                                                    </div>
                                                    <p className="border-t border-slate-800/80 pt-1 font-mono text-[10px] text-slate-400">
                                                      Cắt {splitShotTrimInfo.cutDur.toFixed(1)}s ÷{" "}
                                                      {splitShotTrimInfo.speed}x ={" "}
                                                      <span
                                                        className={`font-bold ${
                                                          splitShotTrimInfo.effectiveDur >=
                                                          splitShotTrimInfo.minDur
                                                            ? "text-emerald-400"
                                                            : "text-amber-400"
                                                        }`}
                                                      >
                                                        {splitShotTrimInfo.effectiveDur.toFixed(1)}s
                                                      </span>
                                                      {splitShotTrimInfo.effectiveDur <
                                                        splitShotTrimInfo.minDur && (
                                                        <span className="ml-1 text-[9px] text-amber-400/90">
                                                          (&lt;
                                                          {splitShotTrimInfo.minDur}s tối thiểu)
                                                        </span>
                                                      )}
                                                    </p>
                                                  </div>

                                                  {/* Apple Photos / iPhone Dual-Handle Video Trimmer (2 cols) */}
                                                  <div className="sm:col-span-2">
                                                    <IPhoneVideoTrimmer
                                                      videoBegin={accordionShot.begin}
                                                      videoEnd={accordionShot.end}
                                                      totalDuration={
                                                        state.sourceVideo?.duration ||
                                                        accordionShot.end ||
                                                        10
                                                      }
                                                      rawBegin={
                                                        accordionShot.rawBegin ??
                                                        accordionShot.begin
                                                      }
                                                      rawEnd={
                                                        accordionShot.rawEnd ?? accordionShot.end
                                                      }
                                                      onChange={(newBegin, newEnd) =>
                                                        handleUpdateShotTrim(
                                                          accordionShot.id,
                                                          newBegin,
                                                          newEnd,
                                                        )
                                                      }
                                                      onScrubStart={() => {
                                                        handleStopSlicer();
                                                      }}
                                                      onScrubMove={(sourceSec) => {
                                                        const targetTime = Math.max(
                                                          0,
                                                          Math.min(
                                                            state.sourceVideo?.duration || 0,
                                                            sourceSec,
                                                          ),
                                                        );
                                                        if (slicerVideoRef.current) {
                                                          slicerVideoRef.current.currentTime =
                                                            targetTime;
                                                        }
                                                        setSlicerTime(targetTime);
                                                      }}
                                                      onScrubEnd={() => {}}
                                                      onSeekPreview={(targetSec) => {
                                                        const targetTime = Math.max(
                                                          0,
                                                          Math.min(
                                                            state.sourceVideo?.duration || 0,
                                                            targetSec,
                                                          ),
                                                        );
                                                        if (slicerVideoRef.current) {
                                                          slicerVideoRef.current.currentTime =
                                                            targetTime;
                                                        }
                                                        setSlicerTime(targetTime);
                                                      }}
                                                    />
                                                  </div>
                                                </div>

                                                {/* Advanced Options (Khoá chữ, Ken Burns, Gán Category, Xoá) - Mặc định mở luôn */}
                                                <div className="border-t border-slate-800/80 pt-2">
                                                  <div className="space-y-2.5 rounded-lg border border-slate-800 bg-slate-950/80 p-2.5">
                                                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                                                      <span className="flex items-center gap-1.5">
                                                        <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                                                        <span>Tùy chọn nâng cao</span>
                                                      </span>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
                                                      {/* Lock flipH */}
                                                      <PermissionGate module="split" action="edit">
                                                        <button
                                                          type="button"
                                                          onClick={() =>
                                                            handleToggleLockFlipH(accordionShot.id)
                                                          }
                                                          className={`flex items-center justify-between rounded-lg border p-2 transition ${
                                                            accordionShot.edits.lockFlipH
                                                              ? "border-amber-500/50 bg-amber-500/20 text-amber-200"
                                                              : "border-slate-800 bg-slate-900 text-slate-300"
                                                          }`}
                                                          title="Khoá không cho phép lật ngang nếu cảnh có chữ/tên thương hiệu"
                                                        >
                                                          <span className="flex items-center gap-1 text-[11px] font-medium">
                                                            {accordionShot.edits.lockFlipH ? (
                                                              <Lock className="h-3.5 w-3.5 text-amber-400" />
                                                            ) : (
                                                              <Unlock className="h-3.5 w-3.5 text-slate-500" />
                                                            )}
                                                            Khoá chữ (L)
                                                          </span>
                                                          <span className="font-mono text-[10px] font-bold">
                                                            {accordionShot.edits.lockFlipH
                                                              ? "LOCKED"
                                                              : "FREE"}
                                                          </span>
                                                        </button>
                                                      </PermissionGate>

                                                      {/* Ken Burns Zoom */}
                                                      <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-900 p-2">
                                                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                          <span>Ken Burns zoom</span>
                                                          <span className="font-mono font-bold text-slate-200">
                                                            {typeof accordionShot.edits.zoom ===
                                                            "object"
                                                              ? `${accordionShot.edits.zoom.depth}x`
                                                              : accordionShot.edits.zoom
                                                                ? "1.2x"
                                                                : "Tắt"}
                                                          </span>
                                                        </div>
                                                        <input
                                                          type="range"
                                                          min="1.0"
                                                          max="1.5"
                                                          step="0.05"
                                                          disabled={!canEditSplit}
                                                          value={
                                                            typeof accordionShot.edits.zoom ===
                                                            "object"
                                                              ? accordionShot.edits.zoom.depth
                                                              : accordionShot.edits.zoom
                                                                ? 1.2
                                                                : 1.0
                                                          }
                                                          onChange={(e) => {
                                                            const depth = Number(e.target.value);
                                                            handleSetZoom(
                                                              accordionShot.id,
                                                              depth <= 1.01 ? false : depth,
                                                            );
                                                          }}
                                                          className="mt-1 h-1 w-full rounded bg-slate-800 accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                        />
                                                      </div>

                                                      {/* Delete current shot */}
                                                      <PermissionGate module="split" action="edit">
                                                        <div className="flex items-center justify-end">
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              handleDeleteShot(accordionShot.id);
                                                              setAccordionShotId(null);
                                                            }}
                                                            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                                                            title="Xoá cảnh này khỏi danh sách"
                                                          >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            <span>Xoá cảnh này</span>
                                                          </button>
                                                        </div>
                                                      </PermissionGate>
                                                    </div>

                                                    {/* Reassign Category buttons */}
                                                    <PermissionGate module="split" action="edit">
                                                      <div className="flex items-center gap-1.5 border-t border-slate-800/80 pt-1.5">
                                                        <span className="shrink-0 text-[10px] font-medium text-slate-400">
                                                          Chuyển sang nhóm:
                                                        </span>
                                                        <div className="flex flex-wrap items-center gap-1">
                                                          {SHOT_CATEGORIES.map((c) => (
                                                            <button
                                                              key={c.id}
                                                              type="button"
                                                              onClick={() => {
                                                                handleCategoryChange(
                                                                  accordionShot.id,
                                                                  c.id,
                                                                );
                                                                setSplitEditingCategory(c.id);
                                                              }}
                                                              disabled={
                                                                !canEditSplit ||
                                                                accordionShot.category === c.id
                                                              }
                                                              className={`rounded border px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-40 ${
                                                                accordionShot.category === c.id
                                                                  ? c.badgeClass
                                                                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"
                                                              }`}
                                                            >
                                                              {c.hotkey}. {c.id.toUpperCase()}
                                                            </button>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    </PermissionGate>
                                                  </div>
                                                </div>
                                              </div>
                                            )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ======================================================== */}
                      {/* RIGHT COLUMN (5/12): VIDEO MONITOR 9:16 + TIMELINE RIBBON */}
                      {/* ======================================================== */}
                      <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:col-span-5">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                              Màn hình duyệt cảnh (Source video monitor)
                            </h3>
                            <span className="font-mono text-xs text-indigo-400">
                              {slicerTime.toFixed(1)}s /{" "}
                              {(state.sourceVideo?.duration || 0).toFixed(1)}s
                            </span>
                          </div>

                          {/* 9:16 Video Canvas Player with live effects */}
                          <div className="relative mx-auto flex aspect-[9/16] max-h-[380px] items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
                            {sourceBlobUrl || state.sourceVideo?.localUrl ? (
                              <video
                                ref={slicerVideoRef}
                                src={sourceBlobUrl || state.sourceVideo?.localUrl}
                                playsInline
                                onTimeUpdate={(e) => {
                                  const cur = e.currentTarget.currentTime;
                                  setSlicerTime(cur);

                                  // If playing active shot only, stop or loop at shot.end
                                  if (playingShotOnly && selectedShot) {
                                    if (cur >= selectedShot.end) {
                                      e.currentTarget.pause();
                                      setIsPlayingSlicer(false);
                                      setPlayingShotOnly(false);
                                    }
                                  }
                                }}
                                onEnded={() => {
                                  setIsPlayingSlicer(false);
                                  setPlayingShotOnly(false);
                                }}
                                className="h-full w-full object-contain"
                                style={{
                                  transform: selectedShot?.edits.flipH ? "scaleX(-1)" : undefined,
                                }}
                              />
                            ) : (
                              <div className="p-6 text-center text-xs text-slate-500">
                                Chưa nạp video
                              </div>
                            )}

                            {/* Active Shot Badge Overlay */}
                            {selectedShot && (
                              <div className="absolute top-2 left-2 z-10 rounded-full border border-white/20 bg-black/60 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                                Đang chọn: {selectedShot.label} (
                                {selectedShot.category?.toUpperCase()})
                              </div>
                            )}
                          </div>

                          {/* Playback Controls Bar */}
                          <div className="flex items-center justify-between gap-2 border-t border-slate-800 pt-1">
                            <div className="flex items-center gap-1.5">
                              {isPlayingSlicer ? (
                                <button
                                  onClick={handleStopSlicer}
                                  className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30"
                                >
                                  <Pause className="h-3.5 w-3.5" />
                                  <span>Tạm dừng</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handlePlayActiveShot()}
                                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  <span>Xem riêng</span>
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (slicerVideoRef.current && selectedShot) {
                                    slicerVideoRef.current.currentTime = selectedShot.begin;
                                    setSlicerTime(selectedShot.begin);
                                  }
                                }}
                                className="rounded-lg bg-slate-800 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700"
                                title="Về đầu cảnh"
                              >
                                Đầu cảnh
                              </button>
                              <button
                                onClick={() => {
                                  if (slicerVideoRef.current && selectedShot) {
                                    slicerVideoRef.current.currentTime = selectedShot.end;
                                    setSlicerTime(selectedShot.end);
                                  }
                                }}
                                className="rounded-lg bg-slate-800 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-700"
                                title="Về cuối cảnh"
                              >
                                Cuối cảnh
                              </button>
                            </div>

                            <PermissionGate module="split" action="edit">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleSplitAtTime(slicerTime)}
                                  className="flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/20 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/30"
                                  title="Tách đôi shot tại con trỏ (phím S)"
                                >
                                  <Scissors className="h-3 w-3" />
                                  <span>Tách (S)</span>
                                </button>
                                {selectedShotId && (
                                  <button
                                    onClick={() => handleMergeWithNext(selectedShotId)}
                                    className="rounded-lg border border-indigo-500/40 bg-indigo-500/20 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/30"
                                    title="Gộp với shot kế tiếp"
                                  >
                                    Gộp sau
                                  </button>
                                )}
                              </div>
                            </PermissionGate>
                          </div>
                        </div>

                        {/* Interactive Timeline Ribbon */}
                        <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Thanh timeline phân đoạn (Click để chọn cảnh)</span>
                            <span className="font-mono text-emerald-400">
                              {state.shots.length} shots
                            </span>
                          </div>

                          <div className="flex h-9 w-full gap-0.5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-0.5">
                            {state.shots.map((shot) => {
                              const totalDur = state.sourceVideo?.duration || 1;
                              const widthPct = Math.max(
                                2,
                                ((shot.end - shot.begin) / totalDur) * 100,
                              );
                              const catObj = SHOT_CATEGORIES.find((c) => c.id === shot.category);
                              const isSel = shot.id === selectedShotId;
                              return (
                                <button
                                  key={shot.id}
                                  onClick={() => {
                                    setSelectedShotId(shot.id);
                                    if (shot.category) {
                                      setSplitEditingCategory(shot.category);
                                      setAccordionShotId(shot.id);
                                    }
                                    if (slicerVideoRef.current) {
                                      slicerVideoRef.current.currentTime = shot.begin;
                                    }
                                    setSlicerTime(shot.begin);
                                  }}
                                  style={{
                                    width: `${widthPct}%`,
                                    backgroundColor: catObj ? `${catObj.color}33` : "#334155",
                                    borderColor: isSel ? "#ffffff" : catObj?.color || "#475569",
                                  }}
                                  className={`flex h-full items-center justify-center truncate rounded-md border px-1 font-mono text-[10px] transition ${
                                    isSel
                                      ? "z-10 font-bold ring-2 ring-white"
                                      : "opacity-80 hover:opacity-100"
                                  }`}
                                  title={`${shot.label} (${shot.begin.toFixed(
                                    1,
                                  )}s - ${shot.end.toFixed(1)}s)`}
                                >
                                  {shot.category ? shot.category.slice(0, 3).toUpperCase() : "?"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 100% WIDTH EXPORT ACTION BAR CARD */}
                    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
                      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            Xuất toàn bộ các cảnh đã tinh chỉnh về máy tính
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Cắt siêu tốc bằng FFmpeg, giữ nguyên chất lượng 100%, bảo toàn mốc giây
                            và mirror đã chỉnh
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5">
                          {canExportSplit && (
                            <>
                              <button
                                type="button"
                                onClick={handleSliceAndDownloadZip}
                                disabled={isSlicing}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                              >
                                <Download className="h-4 w-4 text-rose-400" />
                                <span>Tải ZIP toàn bộ (5 folder)</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleDirectSaveToFolder}
                                disabled={isSlicing}
                                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
                              >
                                <FolderDown className="h-4 w-4" />
                                <span>Lưu thẳng vào thư mục máy tính</span>
                              </button>
                            </>
                          )}
                          <PermissionGate module="split" action="edit">
                            <button
                              type="button"
                              onClick={handleNextVideo}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Tách video tiếp theo</span>
                            </button>
                          </PermissionGate>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======================================================== */}
            {/* TAB 2: TRỘN & GHÉP TỔ HỢP TỪ FOLDER CATEGORY (MIXER 20S) */}
            {/* ======================================================== */}
            {mainTab === "mix" && (
              <div className="space-y-6">
                {/* Top Action Bar: Mode chính (Excel Google Drive) & Mode phụ (Upload máy) */}
                <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                        <Cloud className="h-5 w-5 shrink-0 text-sky-400" />
                        <span>Kho video theo 5 category (Google Drive & máy tính)</span>
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Mode chính: Dán bảng 5 cột từ Excel (Google Drive) với cơ chế zero-disk
                        stream. Mode phụ: Tải trực tiếp thư mục từ máy tính.
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:ml-auto">
                      <button
                        type="button"
                        onClick={() => setShowDriveHistoryDrawer(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-700/60 bg-sky-950/80 px-3.5 py-2 text-xs font-semibold text-sky-200 shadow-sm transition hover:bg-sky-900"
                        title="Xem toàn bộ lịch sử link Google Drive đã nạp vào kho"
                      >
                        <Cloud className="h-4 w-4 text-sky-400" />
                        <span>Lịch sử link Drive ({allDriveLinks.length})</span>
                      </button>
                      <PermissionGate module="mix" action="edit">
                        <button
                          onClick={() => masterFolderInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                          title="Upload thư mục chứa 5 folder OPEN, PRODUCT, TEXTURE, APPLY, END từ máy tính"
                        >
                          <FolderSync className="h-4 w-4 text-indigo-400" />
                          <span>Chọn thư mục tổng từ máy (tự phân 5 cột)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowClearConfirmModal(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-slate-100 shadow-md shadow-rose-600/20 transition hover:bg-rose-500"
                          title="Xóa toàn bộ clip trong kho, voice và danh sách tổ hợp"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Xóa</span>
                        </button>
                      </PermissionGate>
                    </div>
                  </div>

                  {/* Thanh tra cứu nhanh link Drive */}
                  <div className="flex flex-col items-stretch justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/90 p-3 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Search className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type="text"
                        value={quickCheckInput}
                        onChange={(e) => setQuickCheckInput(e.target.value)}
                        placeholder="Kiểm tra nhanh: Dán link Google Drive hoặc File ID vào đây để kiểm tra đã nạp chưa..."
                        className="w-full border-none bg-transparent font-mono text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none"
                      />
                      {quickCheckInput && (
                        <button
                          type="button"
                          onClick={() => setQuickCheckInput("")}
                          className="rounded p-1 text-slate-500 transition hover:text-slate-300"
                          title="Xóa tìm kiếm"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {quickCheckResult && (
                      <div className="flex shrink-0 items-center gap-2 text-xs font-medium">
                        {quickCheckResult.found ? (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            <span>
                              Đã có {quickCheckResult.matches.length} file (
                              {quickCheckResult.matches
                                .map((m) => m.category.toUpperCase())
                                .join(", ")}
                              )
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setDriveHistorySearchText(quickCheckInput);
                                setShowDriveHistoryDrawer(true);
                              }}
                              className="ml-1 cursor-pointer text-[11px] text-emerald-200 underline hover:text-white"
                            >
                              Xem chi tiết
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-slate-300">
                            <Info className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                            <span>Chưa có trong kho (hợp lệ để dán nạp)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mode chính: Dán nhanh bảng 5 cột từ Excel */}
                  <PermissionGate module="mix" action="edit">
                    <div className="space-y-3 rounded-xl border border-sky-500/30 bg-slate-950/80 p-4 shadow-lg shadow-sky-950/20">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/20">
                            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div>
                            <h3 className="flex items-center gap-2 text-xs font-bold text-white">
                              <span>Dán nhanh bảng 5 cột từ Excel (Google Drive)</span>
                              <span className="rounded-full border border-sky-500/40 bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] text-sky-300">
                                Mode chính • Zero-disk stream
                              </span>
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              Bôi đen cả bảng 5 cột (Open, Product, Texture, Apply, End) trong file
                              Excel rồi dán (Ctrl+V) vào khung bên dưới.
                            </p>
                          </div>
                        </div>

                        {parsedExcel.totalExtracted > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setExcelPasteText("")}
                              className="px-2.5 py-1 text-[11px] text-slate-400 transition hover:text-slate-200"
                            >
                              Xoá nội dung dán
                            </button>
                            <button
                              type="button"
                              onClick={handleIngestExcelDriveLinks}
                              disabled={isIngestingDrive}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
                            >
                              {isIngestingDrive ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Cloud className="h-3.5 w-3.5" />
                              )}
                              <span>
                                {isIngestingDrive
                                  ? "Đang nạp file..."
                                  : `+ Nạp ${parsedExcel.totalExtracted} file vào kho (5 category & voice)`}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="relative">
                        <textarea
                          rows={3}
                          value={excelPasteText}
                          onChange={(e) => setExcelPasteText(e.target.value)}
                          placeholder="Dán vùng dữ liệu copy từ Excel vào đây (hệ thống tự động phân tách Tab thành các cột: Open, Product, Texture, Apply, End, Voice)..."
                          className="w-full resize-y rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2.5 font-mono text-xs text-slate-200 transition placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </PermissionGate>

                  {/* 6 Category & Voice Columns in 3x2 Grid */}
                  <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                    {CATEGORY_ORDER.map((catKey) => {
                      const meta = SHOT_CATEGORIES.find((c) => c.id === catKey);
                      const items = categoryPools[catKey] || [];
                      return (
                        <div
                          key={catKey}
                          className="flex min-h-[220px] flex-col justify-between space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5"
                        >
                          {/* Header: Badge & Count on left, Action buttons on right */}
                          <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                                  meta?.badgeClass || "border-slate-700 text-slate-200"
                                }`}
                              >
                                {meta?.label}
                              </span>
                              <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                                {items.length} clip
                              </span>
                            </div>
                            <PermissionGate module="mix" action="edit">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSingleCategoryDriveModal({
                                      category: catKey,
                                      text: "",
                                    })
                                  }
                                  className="flex items-center gap-1 rounded-lg border border-sky-800/60 bg-sky-950/60 px-2 py-1 text-[10px] font-semibold text-sky-200 shadow-sm transition hover:bg-sky-900/80"
                                  title="Dán link Google Drive cho mục này"
                                >
                                  <Link2 className="h-3 w-3 shrink-0 text-sky-400" />
                                  <span>Link Drive</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => categoryInputRefs.current[catKey]?.click()}
                                  className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-300 shadow-sm transition hover:bg-slate-800"
                                  title="Tải file clip từ máy tính"
                                >
                                  <Plus className="h-3 w-3 shrink-0 text-slate-400" />
                                  <span>File</span>
                                </button>
                              </div>
                            </PermissionGate>
                          </div>

                          {/* Items List */}
                          <div className="max-h-64 flex-1 space-y-1.5 overflow-y-auto pr-1">
                            {items.length === 0 ? (
                              <div className="flex h-full flex-col items-center justify-center p-3 text-center text-[11px] text-slate-500">
                                Chưa có clip nào
                              </div>
                            ) : (
                              items.map((it) => {
                                const isDrive = it.sourceType === "drive" || !!it.driveFileId;
                                const driveFileId =
                                  it.driveFileId || extractGoogleDriveFileId(it.localUrl);
                                const driveUrl = driveFileId
                                  ? `https://drive.google.com/file/d/${driveFileId}/view`
                                  : isDrive
                                    ? it.localUrl
                                    : null;

                                return (
                                  <div
                                    key={it.id}
                                    className="group space-y-1 rounded-lg border border-slate-800 bg-slate-900/90 p-2 text-[10px] transition hover:border-slate-700"
                                  >
                                    <div className="flex items-center justify-between gap-1.5">
                                      <div className="flex min-w-0 items-center gap-1.5 truncate">
                                        {isDrive ? (
                                          <span title="Link Google Drive (Zero-disk stream)">
                                            <Cloud className="h-3 w-3 shrink-0 text-sky-400" />
                                          </span>
                                        ) : (
                                          <span title="File video từ máy tính">
                                            <Film className="h-3 w-3 shrink-0 text-slate-400" />
                                          </span>
                                        )}
                                        {it.lockFlipH && (
                                          <span title="Khóa lật gương">
                                            <Lock className="h-2.5 w-2.5 shrink-0 text-amber-400" />
                                          </span>
                                        )}
                                        <span
                                          className="truncate font-medium text-slate-200"
                                          title={it.name}
                                        >
                                          {it.name}
                                        </span>
                                      </div>

                                      <div className="flex shrink-0 items-center gap-1.5">
                                        <span className="font-mono font-semibold text-slate-400">
                                          {it.duration.toFixed(1)}s
                                        </span>
                                        <PermissionGate module="mix" action="edit">
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveCategoryItem(catKey, it.id)}
                                            className="rounded p-0.5 text-slate-500 opacity-60 transition group-hover:opacity-100 hover:bg-slate-800 hover:text-rose-400"
                                            title="Xóa clip này khỏi kho"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </PermissionGate>
                                      </div>
                                    </div>

                                    {driveUrl && (
                                      <div className="flex items-center justify-between gap-1.5 rounded border border-slate-800/60 bg-slate-950/60 px-1.5 py-0.5 pl-4 font-mono text-[9px] text-slate-400">
                                        <a
                                          href={driveUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex max-w-[170px] items-center gap-1 truncate text-sky-400 hover:text-sky-300 hover:underline"
                                          title={`Mở link Drive: ${driveUrl}`}
                                        >
                                          <span className="truncate">{driveUrl}</span>
                                          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(driveUrl);
                                            addToast({
                                              type: "info",
                                              text: "Đã sao chép link Google Drive.",
                                            });
                                          }}
                                          className="shrink-0 rounded p-0.5 text-slate-500 transition hover:text-slate-200"
                                          title="Sao chép link Drive"
                                        >
                                          <Copy className="h-2.5 w-2.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Box 6: VOICE (LỒNG TIẾNG) */}
                    <div className="flex min-h-[220px] flex-col justify-between space-y-2.5 rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
                      {/* Header: Badge & Count on left, Action buttons on right */}
                      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-bold text-indigo-300">
                            Voice
                          </span>
                          <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            {multiVoices.length} voice
                          </span>
                        </div>
                        <PermissionGate module="mix" action="edit">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setSingleCategoryDriveModal({
                                  category: "voice",
                                  text: "",
                                })
                              }
                              className="flex items-center gap-1 rounded-lg border border-sky-800/60 bg-sky-950/60 px-2 py-1 text-[10px] font-semibold text-sky-200 shadow-sm transition hover:bg-sky-900/80"
                              title="Dán link Google Drive cho lồng tiếng"
                            >
                              <Link2 className="h-3 w-3 shrink-0 text-sky-400" />
                              <span>Link Drive</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => voiceInputRef.current?.click()}
                              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-[10px] font-semibold text-slate-300 shadow-sm transition hover:bg-slate-800"
                              title="Tải file voice từ máy tính"
                            >
                              <Plus className="h-3 w-3 shrink-0 text-slate-400" />
                              <span>File</span>
                            </button>
                          </div>
                        </PermissionGate>
                      </div>

                      {/* Inline Voice Mode Toggle */}
                      <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/70 px-2 py-1.5 text-[11px]">
                        <span className="font-medium text-slate-400">Chế độ lồng tiếng:</span>
                        <div className="flex items-center gap-3">
                          <label className="flex cursor-pointer items-center gap-1">
                            <input
                              type="radio"
                              name="boxVoiceMode"
                              disabled={!canEditMix}
                              checked={mixVoiceMode === "none"}
                              onChange={() => setMixVoiceMode("none")}
                              className="accent-indigo-500 disabled:opacity-50"
                            />
                            <span
                              className={
                                mixVoiceMode === "none" ? "text-slate-200" : "text-slate-500"
                              }
                            >
                              Không lồng
                            </span>
                          </label>
                          <label className="flex cursor-pointer items-center gap-1">
                            <input
                              type="radio"
                              name="boxVoiceMode"
                              disabled={!canEditMix}
                              checked={mixVoiceMode === "rotate"}
                              onChange={() => setMixVoiceMode("rotate")}
                              className="accent-indigo-500 disabled:opacity-50"
                            />
                            <span
                              className={
                                mixVoiceMode === "rotate"
                                  ? "font-medium text-indigo-300"
                                  : "text-slate-500"
                              }
                            >
                              Xoay vòng
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Voice Items List */}
                      <div className="max-h-64 flex-1 space-y-1.5 overflow-y-auto pr-1">
                        {multiVoices.length === 0 ? (
                          <div className="flex h-full flex-col items-center justify-center p-3 text-center text-[11px] text-slate-500">
                            Chưa có voice nào
                          </div>
                        ) : (
                          multiVoices.map((v) => {
                            const isDrive = v.sourceType === "drive" || !!v.driveFileId;
                            const driveFileId =
                              v.driveFileId || extractGoogleDriveFileId(v.driveRawUrl || "");
                            const driveUrl =
                              v.driveRawUrl ||
                              (driveFileId
                                ? `https://drive.google.com/file/d/${driveFileId}/view`
                                : isDrive
                                  ? v.localUrl
                                  : null);

                            return (
                              <div
                                key={v.id}
                                className="group space-y-1 rounded-lg border border-slate-800 bg-slate-900/90 p-2 text-[10px] transition hover:border-slate-700"
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex min-w-0 items-center gap-1.5 truncate">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAuditionVoice(v)}
                                      className={`shrink-0 rounded p-1 transition ${
                                        auditionVoiceId === v.id
                                          ? "bg-indigo-600 text-white"
                                          : "text-slate-400 hover:bg-slate-800 hover:text-indigo-300"
                                      }`}
                                      title={
                                        auditionVoiceId === v.id
                                          ? "Dừng nghe thử"
                                          : "Nghe thử file này"
                                      }
                                    >
                                      {auditionVoiceId === v.id ? (
                                        <Square className="h-2.5 w-2.5 fill-current" />
                                      ) : (
                                        <Play className="h-2.5 w-2.5 fill-current" />
                                      )}
                                    </button>
                                    {isDrive ? (
                                      <span title="Link Google Drive (Zero-disk stream)">
                                        <Cloud className="h-3 w-3 shrink-0 text-sky-400" />
                                      </span>
                                    ) : (
                                      <span title="File âm thanh từ máy tính">
                                        <Music className="h-3 w-3 shrink-0 text-slate-400" />
                                      </span>
                                    )}
                                    <span
                                      className="truncate font-medium text-slate-200"
                                      title={v.name}
                                    >
                                      {v.name}
                                    </span>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1.5">
                                    <span className="font-mono font-semibold text-slate-400">
                                      {v.duration.toFixed(1)}s
                                    </span>
                                    <PermissionGate module="mix" action="edit">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveVoiceItem(v.id)}
                                        className="rounded p-0.5 text-slate-500 opacity-60 transition group-hover:opacity-100 hover:bg-slate-800 hover:text-rose-400"
                                        title="Xóa voice này khỏi kho"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </PermissionGate>
                                  </div>
                                </div>

                                {driveUrl && (
                                  <div className="flex items-center justify-between gap-1.5 rounded border border-slate-800/60 bg-slate-950/60 px-1.5 py-0.5 pl-5 font-mono text-[9px] text-slate-400">
                                    <a
                                      href={driveUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex max-w-[170px] items-center gap-1 truncate text-sky-400 hover:text-sky-300 hover:underline"
                                      title={`Mở link Drive: ${driveUrl}`}
                                    >
                                      <span className="truncate">{driveUrl}</span>
                                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(driveUrl);
                                        addToast({
                                          type: "info",
                                          text: "Đã sao chép link Google Drive.",
                                        });
                                      }}
                                      className="shrink-0 rounded p-0.5 text-slate-500 transition hover:text-slate-200"
                                      title="Sao chép link Drive"
                                    >
                                      <Copy className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mixer Settings: Single Clean Row Aligned Right */}
                <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 sm:flex-nowrap sm:gap-4 sm:p-4">
                  <div className="flex min-w-0 flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
                    {/* Clip Name Pattern Input */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Edit3 className="h-4 w-4 shrink-0 text-indigo-400" />
                      <label className="text-xs font-bold whitespace-nowrap text-white">
                        Tên clip:
                      </label>
                      <input
                        type="text"
                        disabled={!canEditMix}
                        value={clipNamePrefix}
                        onChange={(e) => setClipNamePrefix(e.target.value)}
                        onBlur={() => persistProjectSettings()}
                        placeholder={currentProjectName || "Ví dụ: Brand A"}
                        className="w-36 rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
                        title={
                          canEditMix
                            ? "Tiền tố tên cho các video khi trộn (sẽ tự động thêm #1, #2...)"
                            : "Chế độ chỉ xem"
                        }
                      />
                    </div>

                    {/* Video Count Input */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-rose-400" />
                      <label className="text-xs font-bold whitespace-nowrap text-white">
                        Số video muốn tạo:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        disabled={!canEditMix}
                        value={targetMixCount}
                        onChange={(e) =>
                          setTargetMixCount(
                            Math.max(1, Math.min(50, parseInt(e.target.value) || 1)),
                          )
                        }
                        onBlur={() => persistProjectSettings()}
                        className="w-16 rounded-xl border border-slate-800 bg-slate-950 px-2.5 py-2 text-center font-mono text-xs font-bold text-white focus:border-rose-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:w-20"
                      />
                      <span className="hidden text-[11px] whitespace-nowrap text-slate-400 xl:inline">
                        video (Tối đa 50)
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <button
                      type="button"
                      disabled={!canEditMix && !canExportMix}
                      onClick={handlePlanDiverseMix}
                      className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:scale-[1.02] hover:bg-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      title={
                        canEditMix || canExportMix
                          ? "Tạo tổ hợp trộn video tự động"
                          : "Bạn không có quyền trộn video"
                      }
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Trộn</span>
                    </button>
                  </div>
                </div>

                {/* Generated Composed Videos & 9:16 Canvas Preview */}
                {state?.composedVideos && state.composedVideos.length > 0 && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Left: Combinations List */}
                    <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-7">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            Danh sách {state.composedVideos.length} tổ hợp video
                          </h3>
                          <p className="text-xs text-slate-400">
                            Click vào cảnh (OPEN,...) để chỉnh tốc độ, cắt giây, lật gương
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {canEditMix && (
                            <button
                              type="button"
                              onClick={() => setShowMarkAllRenderedModal(true)}
                              disabled={Boolean(busyMessage) || isMarkingAllRendered}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-md shadow-slate-900/40 transition hover:bg-slate-700 disabled:opacity-50"
                              title="Đánh dấu tất cả video trong danh sách tổ hợp đã render vào lịch sử"
                            >
                              <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Đánh dấu đã render</span>
                            </button>
                          )}
                          {canExportMix && (
                            <button
                              onClick={handleRenderAllComposedZip}
                              disabled={Boolean(busyMessage)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
                              title="Render toàn bộ video bằng FFmpeg và nén ZIP tải về máy"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>Tải tất cả</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="max-h-[550px] space-y-3 overflow-y-auto pr-1">
                        {state.composedVideos.map((comp, idx) => {
                          const isSelected = selectedComposed?.id === comp.id;
                          const activeSlotIdx =
                            isSelected && editingSlotCategory
                              ? comp.slots.findIndex((s) => s.category === editingSlotCategory)
                              : -1;
                          const activeSlot = activeSlotIdx >= 0 ? comp.slots[activeSlotIdx] : null;
                          const isCardPlaying =
                            isSelected && isPreviewPlaying && previewMode === "full";
                          const isRendered = renderedHistoryList.some(
                            (r) => r.tupleKey === comp.tupleKey,
                          );

                          return (
                            <div
                              key={comp.id}
                              onClick={() => setSelectedComposedId(comp.id)}
                              className={`rounded-xl border p-3.5 transition ${
                                isSelected
                                  ? "border-rose-500/80 bg-slate-800/95 shadow-lg shadow-rose-500/10"
                                  : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                              }`}
                            >
                              <div className="mb-2.5 flex items-center justify-between">
                                <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-white">
                                  <span>
                                    #{idx + 1} — {comp.name}
                                  </span>
                                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                                    ⏱️ Tổng: {comp.finalDuration.toFixed(1)}s
                                  </span>
                                  {isRendered && (
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                      <Check className="h-3 w-3 stroke-[2.5] text-emerald-400" />
                                      <span>Đã render</span>
                                    </span>
                                  )}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (isCardPlaying) {
                                        setPauseTrigger((prev) => prev + 1);
                                      } else {
                                        setSelectedComposedId(comp.id);
                                        setEditingSlotCategory(null);
                                        setActiveSlotFocusIndex(null);
                                        setPreviewMode("full");
                                        setPlayTrigger((prev) => prev + 1);
                                      }
                                    }}
                                    className={`rounded-lg p-2 text-white shadow-md transition ${
                                      isCardPlaying
                                        ? "bg-amber-600 shadow-amber-600/20 hover:bg-amber-500"
                                        : "bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500"
                                    }`}
                                    title={
                                      isCardPlaying
                                        ? "Tạm dừng phát thử"
                                        : "Xem trước toàn bộ video (5 cảnh)"
                                    }
                                    aria-label={isCardPlaying ? "Tạm dừng" : "Phát video"}
                                  >
                                    {isCardPlaying ? (
                                      <Pause className="h-3.5 w-3.5 fill-current" />
                                    ) : (
                                      <Play className="h-3.5 w-3.5 fill-current" />
                                    )}
                                  </button>
                                  {canExportMix && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRenderSingleComposed(comp);
                                      }}
                                      className="rounded-lg bg-rose-600 p-2 text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-500"
                                      title="Xuất file MP4 hoàn chỉnh bằng FFmpeg"
                                      aria-label="Xuất file MP4"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* 5 Slots Badges */}
                              <div className="grid grid-cols-5 gap-1.5">
                                {comp.slots.map((slot, sIdx) => {
                                  const slotDur = (slot.exitEnd - slot.enterBegin).toFixed(1);
                                  const isSlotActive =
                                    isSelected && editingSlotCategory === slot.category;
                                  return (
                                    <button
                                      key={`${comp.id}_${slot.category}`}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedComposedId(comp.id);
                                        const willBeActive = !isSlotActive;
                                        setEditingSlotCategory(willBeActive ? slot.category : null);
                                        setActiveSlotFocusIndex(willBeActive ? sIdx : null);
                                        setPreviewMode(willBeActive ? "slot" : "full");
                                      }}
                                      className={`cursor-pointer rounded-lg border p-1.5 text-left text-[10px] transition ${
                                        isSlotActive
                                          ? "border-rose-500 bg-rose-950/70 shadow-md ring-2 shadow-rose-500/20 ring-rose-500/50"
                                          : "border-slate-800 bg-slate-900 hover:border-slate-700"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between font-bold text-slate-300 uppercase">
                                        <span
                                          className={
                                            isSlotActive ? "font-extrabold text-rose-300" : ""
                                          }
                                        >
                                          {slot.category}
                                        </span>
                                        <span className="font-mono font-bold text-rose-300">
                                          {slotDur}s
                                        </span>
                                      </div>
                                      <div
                                        className="mt-0.5 truncate text-[9px] text-slate-400"
                                        title={slot.shotLabel}
                                      >
                                        {slot.shotLabel}
                                      </div>
                                      <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] text-slate-500">
                                        <span>
                                          {slot.videoBegin.toFixed(1)}s–
                                          {slot.videoEnd.toFixed(1)}s
                                        </span>
                                        <span
                                          className={
                                            slot.speed > 1
                                              ? "font-semibold text-cyan-400"
                                              : slot.speed < 1
                                                ? "font-semibold text-amber-400"
                                                : "text-slate-400"
                                          }
                                        >
                                          {slot.speed}x
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Voice Track Selector for this Composed Video */}
                              <div className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px]">
                                <div className="flex items-center gap-1.5 text-slate-400">
                                  <Mic className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                                  <span className="text-[10px] text-slate-300">Lồng tiếng:</span>
                                </div>
                                <select
                                  value={comp.voiceTrackId || ""}
                                  disabled={!canEditMix}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleChangeComposedVoice(comp.id, e.target.value || null);
                                  }}
                                  className="max-w-[210px] truncate rounded-lg border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-indigo-300 focus:border-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <option value="">(Không lồng voice)</option>
                                  {multiVoices.map((v) => (
                                    <option key={v.id} value={v.id}>
                                      🎵 {v.name} ({v.duration.toFixed(1)}s)
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Inline Scene Inspector */}
                              {isSelected && activeSlot && activeSlotIdx >= 0 && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="animate-in fade-in mt-3 space-y-3 rounded-xl border border-rose-500/40 bg-slate-900 p-3.5 duration-200"
                                >
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-md border border-rose-500/30 bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300 uppercase">
                                        Cảnh {activeSlot.category}
                                      </span>
                                      <span
                                        className="max-w-[180px] truncate text-xs text-slate-200"
                                        title={activeSlot.shotLabel}
                                      >
                                        {activeSlot.shotLabel}
                                      </span>
                                      <span className="hidden font-mono text-[10px] text-slate-400 sm:inline">
                                        (Gốc:{" "}
                                        {(
                                          activeSlot.originalVideoEnd || activeSlot.videoEnd
                                        ).toFixed(1)}
                                        s)
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {/* Compact Mirror Toggle Button */}
                                      <button
                                        type="button"
                                        disabled={!canEditMix}
                                        onClick={() =>
                                          handleUpdateComposedSlot(comp.id, activeSlotIdx, {
                                            flipH: !activeSlot.flipH,
                                          })
                                        }
                                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold transition ${
                                          activeSlot.flipH
                                            ? "border-rose-500/60 bg-rose-600/30 text-rose-300 shadow-sm"
                                            : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
                                        } ${!canEditMix ? "cursor-not-allowed opacity-50" : ""}`}
                                        title={
                                          !canEditMix
                                            ? "Chế độ chỉ xem, không thể đổi mirror"
                                            : "Lật gương ngang hình ảnh (Mirror)"
                                        }
                                      >
                                        <FlipHorizontal className="h-3.5 w-3.5" />
                                        <span>
                                          {activeSlot.flipH ? "Đang lật gương" : "Lật gương"}
                                        </span>
                                      </button>

                                      <button
                                        onClick={() => {
                                          setPreviewMode("slot");
                                          setActiveSlotFocusIndex(activeSlotIdx);
                                          setPlayTrigger((prev) => prev + 1);
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2.5 py-1 text-[10px] text-slate-200 transition hover:bg-slate-700"
                                        title="Phát thử đoạn video này trên player"
                                      >
                                        <Play className="h-3 w-3 fill-current text-rose-400" />
                                        <span>Xem đoạn này</span>
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingSlotCategory(null);
                                          setPreviewMode("full");
                                        }}
                                        className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                                        title="Thu gọn bảng chỉnh sửa"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
                                    {/* Speed Controls */}
                                    <div className="flex flex-col justify-between space-y-1.5 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                                      <div>
                                        <label className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-slate-300">
                                          <span>Tốc độ phát:</span>
                                          <span className="font-mono font-bold text-rose-400">
                                            {activeSlot.speed}x
                                          </span>
                                        </label>
                                        <div className="mb-2 flex flex-wrap items-center gap-1">
                                          {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((spd) => (
                                            <button
                                              key={spd}
                                              type="button"
                                              disabled={!canEditMix}
                                              onClick={() =>
                                                handleUpdateComposedSlot(comp.id, activeSlotIdx, {
                                                  speed: spd,
                                                })
                                              }
                                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                                                activeSlot.speed === spd
                                                  ? "bg-rose-600 font-bold text-white"
                                                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                                              } disabled:cursor-not-allowed disabled:opacity-50`}
                                            >
                                              {spd}x
                                            </button>
                                          ))}
                                        </div>
                                        <input
                                          type="range"
                                          min="0.25"
                                          max="3.0"
                                          step="0.05"
                                          disabled={!canEditMix}
                                          value={activeSlot.speed}
                                          onChange={(e) =>
                                            handleUpdateComposedSlot(comp.id, activeSlotIdx, {
                                              speed: parseFloat(e.target.value) || 1.0,
                                            })
                                          }
                                          className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        />
                                      </div>
                                      <p className="border-t border-slate-800/80 pt-1 font-mono text-[10px] text-slate-400">
                                        Cắt{" "}
                                        {(activeSlot.videoEnd - activeSlot.videoBegin).toFixed(1)}s
                                        ÷ {activeSlot.speed}x ={" "}
                                        <span className="font-bold text-emerald-400">
                                          {(
                                            (activeSlot.videoEnd - activeSlot.videoBegin) /
                                            activeSlot.speed
                                          ).toFixed(1)}
                                          s
                                        </span>
                                      </p>
                                    </div>

                                    {/* Apple Photos / iPhone Dual-Handle Video Trimmer (2 cols) */}
                                    <div className="sm:col-span-2">
                                      <IPhoneVideoTrimmer
                                        videoBegin={activeSlot.videoBegin}
                                        videoEnd={activeSlot.videoEnd}
                                        maxDuration={
                                          activeSlot.originalVideoEnd || activeSlot.videoEnd || 10
                                        }
                                        onChange={(begin, end) =>
                                          handleUpdateComposedSlot(comp.id, activeSlotIdx, {
                                            videoBegin: begin,
                                            videoEnd: end,
                                          })
                                        }
                                        onScrubStart={() => {
                                          setIsScrubbing(true);
                                          setPreviewMode("slot");
                                          setActiveSlotFocusIndex(activeSlotIdx);
                                        }}
                                        onScrubMove={(sourceSec) => {
                                          setScrubSourceSec(sourceSec);
                                        }}
                                        onScrubEnd={() => {
                                          setIsScrubbing(false);
                                        }}
                                        onSeekPreview={(targetSec) => {
                                          setActiveSlotFocusIndex(activeSlotIdx);
                                          const timelinePos =
                                            activeSlot.enterBegin +
                                            (targetSec - activeSlot.videoBegin) /
                                              (activeSlot.speed || 1);
                                          setPreviewSeekSec(timelinePos);
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: 9:16 Canvas Preview */}
                    <div className="flex flex-col items-center justify-between space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-5">
                      <div className="flex w-full items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white">Web canvas preview 9:16</h3>
                          <p className="text-xs text-slate-400">
                            Chuyển cảnh 0ms (Ping-Pong Video A/B)
                          </p>
                        </div>
                      </div>

                      {selectedComposed ? (
                        <PreviewPlayer916
                          composed={selectedComposed}
                          sourceVideo={state.sourceVideo}
                          voiceTrack={selectedVoiceTrack}
                          enableVoice={Boolean(selectedVoiceTrack)}
                          previewMode={previewMode}
                          isolatedSlotIndex={
                            previewMode === "slot" && typeof activeSlotFocusIndex === "number"
                              ? activeSlotFocusIndex
                              : null
                          }
                          isScrubbing={isScrubbing}
                          scrubSourceSec={scrubSourceSec}
                          playTrigger={playTrigger}
                          pauseTrigger={pauseTrigger}
                          onPlayingChange={setIsPreviewPlaying}
                          activeSlotFocusIndex={activeSlotFocusIndex}
                          seekTimelineSec={previewSeekSec}
                          onSlotFocusChange={(idx) => {
                            setActiveSlotFocusIndex(idx);
                            const cat = selectedComposed.slots[idx]?.category;
                            if (cat) setEditingSlotCategory(cat);
                            setPreviewMode("slot");
                          }}
                        />
                      ) : (
                        <div className="flex h-[480px] items-center justify-center text-xs text-slate-500">
                          Hãy tạo tổ hợp để xem trước.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Direct Local Export Section */}
                {canExportMix && state?.composedVideos && state.composedVideos.length > 0 && (
                  <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                          <Download className="h-4 w-4 text-emerald-400" />
                          <span>Xuất toàn bộ các video tổ hợp về máy tính</span>
                        </h3>
                        <p className="mt-1 text-xs text-slate-400">
                          Render trực tiếp qua FFmpeg (1080×1920 MP4) và lưu thẳng về máy không qua
                          trung gian.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={handleRenderAllComposedZip}
                          disabled={Boolean(busyMessage)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Tải ZIP toàn bộ ({state.composedVideos.length} MP4)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: LỊCH SỬ RENDER */}
            {mainTab === "history" && (
              <div className="animate-in fade-in space-y-5 duration-150">
                {/* Header Toolbar */}
                <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
                        <History className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="flex items-center gap-2.5 text-base font-extrabold text-white">
                          <span>Lịch sử video đã render</span>
                          <span className="rounded-full border border-indigo-500/40 bg-indigo-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-300">
                            {renderedHistoryList.length} video
                          </span>
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Quản lý trạng thái sử dụng của từng video đã xuất file. Thuật toán tự động
                          ghi nhận và loại trừ các cảnh này khi tạo mẻ video mới.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Export Dropdown */}
                      {canExportHistory && (
                        <div className="relative">
                          <button
                            type="button"
                            disabled={renderedHistoryList.length === 0}
                            onClick={() => setShowExportMenu((prev) => !prev)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                            title="Xuất toàn bộ lịch sử video ra file bảng tính"
                          >
                            <Download className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Xuất file</span>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                          </button>

                          {showExportMenu && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowExportMenu(false)}
                              />
                              <div className="animate-in fade-in zoom-in-95 absolute right-0 z-50 mt-1.5 w-48 rounded-xl border border-slate-700/80 bg-slate-900 py-1.5 shadow-2xl duration-150">
                                <button
                                  type="button"
                                  onClick={() => handleExportHistory("xlsx")}
                                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white"
                                >
                                  <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                                  <span>Xuất Excel (.xlsx)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExportHistory("csv")}
                                  className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-xs font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white"
                                >
                                  <Code2 className="h-4 w-4 text-sky-400" />
                                  <span>Xuất CSV (.csv)</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={fetchRenderedHistory}
                        disabled={isLoadingHistory}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 disabled:opacity-50"
                        title="Tải lại danh sách lịch sử"
                      >
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${
                            isLoadingHistory ? "animate-spin text-indigo-400" : ""
                          }`}
                        />
                        <span>Làm mới</span>
                      </button>
                      {renderedHistoryList.length > 0 && (
                        <PermissionGate module="history" action="edit">
                          <button
                            type="button"
                            onClick={() => setShowClearHistoryConfirmModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                            title="Xóa toàn bộ lịch sử video đã render của dự án này"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Xóa toàn bộ lịch sử</span>
                          </button>
                        </PermissionGate>
                      )}
                    </div>
                  </div>

                  {/* Filters, Search & Sort Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3">
                    {/* Status Filter Tabs */}
                    <div className="flex items-center rounded-xl border border-slate-800 bg-slate-950 p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setHistoryFilterStatus("all")}
                        className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                          historyFilterStatus === "all"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Tất cả ({historyCounts.all})
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryFilterStatus("unused")}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                          historyFilterStatus === "unused"
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        <span>Chưa sử dụng ({historyCounts.unused})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryFilterStatus("used")}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                          historyFilterStatus === "used"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span>Đã sử dụng ({historyCounts.used})</span>
                      </button>
                    </div>

                    <div className="flex flex-1 items-center justify-end gap-2 sm:flex-initial">
                      {/* Search Input */}
                      <div className="relative flex-1 sm:w-64">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={historySearchText}
                          onChange={(e) => setHistorySearchText(e.target.value)}
                          placeholder="Tìm theo tên video, cảnh..."
                          className="w-full rounded-xl border border-slate-800 bg-slate-950 py-1.5 pr-7 pl-8 text-xs text-slate-200 transition placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                        {historySearchText && (
                          <button
                            type="button"
                            onClick={() => setHistorySearchText("")}
                            className="absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Sort Order Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          setHistorySortOrder((prev) => (prev === "desc" ? "asc" : "desc"))
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
                        title={`Đang sắp xếp: ${
                          historySortOrder === "desc" ? "Mới nhất trước" : "Cũ nhất trước"
                        }`}
                      >
                        <ArrowUpDown className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="hidden sm:inline">
                          {historySortOrder === "desc" ? "Mới nhất trước" : "Cũ nhất trước"}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Table or Empty/Loading State */}
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                    <span className="text-xs font-medium">
                      Đang tải danh sách lịch sử render...
                    </span>
                  </div>
                ) : renderedHistoryList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/50 px-6 py-20 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700/60 bg-slate-800/60 text-slate-500 shadow-inner">
                      <Film className="h-8 w-8" />
                    </div>
                    <div className="max-w-md space-y-1">
                      <h3 className="text-sm font-bold text-white">
                        Chưa có video nào trong lịch sử render
                      </h3>
                      <p className="text-xs text-slate-400">
                        Khi bạn xuất file MP4 đơn lẻ hoặc tải ZIP toàn bộ ở tab &quot;Trộn
                        ghép&quot;, các video sẽ tự động được lưu vào đây và không bị trùng cảnh ở
                        các lần tạo tiếp theo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMainTab("mix")}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
                    >
                      <Shuffle className="h-4 w-4" />
                      <span>Sang tab trộn ghép ngay</span>
                    </button>
                  </div>
                ) : filteredHistoryList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl border border-slate-800/80 bg-slate-900/40 px-6 py-16 text-center">
                    <Search className="mb-1 h-7 w-7 text-slate-500" />
                    <h3 className="text-sm font-bold text-white">Không tìm thấy video phù hợp</h3>
                    <p className="text-xs text-slate-400">
                      Thử đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm khác.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryFilterStatus("all");
                        setHistorySearchText("");
                      }}
                      className="mt-2 text-xs font-semibold text-indigo-400 underline hover:text-indigo-300"
                    >
                      Đặt lại bộ lọc
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                            <th className="w-12 px-4 py-3.5 text-center">STT</th>
                            <th className="min-w-[220px] px-4 py-3.5">Tên video</th>
                            <th className="w-28 px-3 py-3.5 text-center">Thời lượng</th>
                            <th className="min-w-[240px] px-4 py-3.5">5 Cảnh tổ hợp</th>
                            <th className="min-w-[120px] px-3 py-3.5">Voice</th>
                            <PermissionGate module="history" action="edit">
                              <th className="w-44 px-4 py-3.5 text-center">Trạng thái</th>
                            </PermissionGate>
                            <th className="w-24 px-4 py-3.5 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {paginatedHistoryList.map((rec, rIdx) => {
                            const comp = rec.payload as ComposedVideo | undefined;
                            const isUsed = rec.status === "used";
                            const globalIdx = (historyPage - 1) * historyPageSize + rIdx + 1;
                            const dateStr = rec.renderedAt
                              ? new Date(rec.renderedAt).toLocaleString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : "";
                            const voiceItem = comp?.voiceTrackId
                              ? multiVoices.find((v) => v.id === comp.voiceTrackId)
                              : null;

                            return (
                              <tr
                                key={rec.id || rIdx}
                                onClick={() => setSelectedHistoryDetail(rec)}
                                className="group cursor-pointer transition hover:bg-slate-800/40"
                              >
                                {/* STT */}
                                <td className="px-4 py-3 text-center font-mono text-slate-400">
                                  #{globalIdx}
                                </td>

                                {/* Tên video & ngày render */}
                                <td className="px-4 py-3">
                                  <div className="line-clamp-1 font-bold text-white transition group-hover:text-indigo-300">
                                    {rec.name || `Video #${globalIdx}`}
                                  </div>
                                  {dateStr && (
                                    <div className="mt-0.5 font-mono text-[11px] text-slate-400">
                                      ⏱️ {dateStr}
                                    </div>
                                  )}
                                </td>

                                {/* Thời lượng */}
                                <td className="px-3 py-3 text-center">
                                  {comp?.finalDuration ? (
                                    <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                                      {comp.finalDuration.toFixed(1)}s
                                    </span>
                                  ) : (
                                    <span className="text-slate-500">-</span>
                                  )}
                                </td>

                                {/* 5 Cảnh tổ hợp */}
                                <td className="px-4 py-3">
                                  {comp?.slots && comp.slots.length > 0 ? (
                                    <div className="flex items-center gap-1">
                                      {comp.slots.map((s, sIdx) => {
                                        const catMeta = SHOT_CATEGORIES.find(
                                          (c) => c.id === s.category,
                                        );
                                        return (
                                          <div
                                            key={sIdx}
                                            className={`max-w-[80px] truncate rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                              catMeta?.badgeClass ||
                                              "border-slate-700 bg-slate-800 text-slate-300"
                                            }`}
                                            title={`${s.category.toUpperCase()}: ${
                                              s.shotLabel || s.shotId
                                            } (${s.videoBegin.toFixed(
                                              1,
                                            )}s - ${s.videoEnd.toFixed(1)}s)`}
                                          >
                                            {s.category.slice(0, 1).toUpperCase()}:{" "}
                                            {s.shotLabel || s.shotId}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span
                                      className="block max-w-[180px] truncate font-mono text-[11px] text-slate-500"
                                      title={rec.tupleKey}
                                    >
                                      {rec.tupleKey}
                                    </span>
                                  )}
                                </td>

                                {/* Voice */}
                                <td className="px-3 py-3">
                                  {comp?.voiceTrackId ? (
                                    <span
                                      className="inline-flex max-w-[120px] items-center gap-1 truncate rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-[11px] text-indigo-300"
                                      title={voiceItem?.name || "Có lồng voice"}
                                    >
                                      🎙️ {voiceItem?.name || "Voice"}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-slate-500">-</span>
                                  )}
                                </td>

                                {/* Trạng thái (Switch toggle) */}
                                <PermissionGate module="history" action="edit">
                                  <td
                                    className="px-4 py-3 text-center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isUsed}
                                        onClick={(e) => handleToggleHistoryStatus(rec, e)}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                          isUsed ? "bg-emerald-500" : "bg-slate-700"
                                        }`}
                                        title={
                                          isUsed
                                            ? "Bấm để đánh dấu là chưa sử dụng"
                                            : "Bấm để đánh dấu là đã sử dụng"
                                        }
                                      >
                                        <span
                                          aria-hidden="true"
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                            isUsed ? "translate-x-4" : "translate-x-0"
                                          }`}
                                        />
                                      </button>
                                      <span
                                        className={`min-w-[75px] text-left text-[11px] font-medium select-none ${
                                          isUsed ? "font-bold text-emerald-400" : "text-slate-400"
                                        }`}
                                      >
                                        {isUsed ? "Đã dùng" : "Chưa dùng"}
                                      </span>
                                    </div>
                                  </td>
                                </PermissionGate>

                                {/* Thao tác */}
                                <td
                                  className="px-4 py-3 text-right"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-end gap-1.5">
                                    {comp && (
                                      <PermissionGate module="history" action="export">
                                        <button
                                          type="button"
                                          onClick={() => handleRenderSingleComposed(comp)}
                                          className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-200 transition hover:bg-slate-700"
                                          title="Tải lại file MP4 này về máy"
                                        >
                                          <Download className="h-3.5 w-3.5 text-emerald-400" />
                                        </button>
                                      </PermissionGate>
                                    )}
                                    <PermissionGate module="history" action="edit">
                                      <button
                                        type="button"
                                        onClick={() => setHistoryItemPendingDelete(rec)}
                                        className="rounded-lg border border-transparent p-1.5 text-slate-400 transition hover:border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-400"
                                        title="Xóa bản ghi này khỏi lịch sử"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </PermissionGate>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 bg-slate-950/40 p-4 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <span>
                          Hiển thị{" "}
                          <strong className="text-white">
                            {(historyPage - 1) * historyPageSize + 1}
                          </strong>
                          –
                          <strong className="text-white">
                            {Math.min(filteredHistoryList.length, historyPage * historyPageSize)}
                          </strong>{" "}
                          trên tổng số{" "}
                          <strong className="text-white">{filteredHistoryList.length}</strong> video
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Page Size Selector */}
                        <div className="flex items-center gap-1.5">
                          <span>Dòng mỗi trang:</span>
                          <select
                            value={historyPageSize}
                            onChange={(e) => setHistoryPageSize(Number(e.target.value))}
                            className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                          </select>
                        </div>

                        {/* Pagination Page Controls */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={historyPage <= 1}
                            onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                            className="rounded-lg bg-slate-800 p-1.5 text-slate-300 transition hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800"
                            title="Trang trước"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <span className="px-2 font-mono text-slate-300">
                            {historyPage} / {totalHistoryPages}
                          </span>
                          <button
                            type="button"
                            disabled={historyPage >= totalHistoryPages}
                            onClick={() =>
                              setHistoryPage((prev) => Math.min(totalHistoryPages, prev + 1))
                            }
                            className="rounded-lg bg-slate-800 p-1.5 text-slate-300 transition hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800"
                            title="Trang tiếp theo"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SLIDE-OVER DRAWER CHI TIẾT VIDEO (TRƯỢT TỪ BÊN PHẢI) */}
                {selectedHistoryDetail && (
                  <div className="animate-in fade-in fixed inset-0 z-50 overflow-hidden duration-200">
                    {/* Backdrop */}
                    <div
                      onClick={() => setSelectedHistoryDetail(null)}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    />

                    <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
                      <div className="animate-in slide-in-from-right flex w-screen max-w-xl flex-col justify-between overflow-hidden border-l border-slate-800 bg-slate-900 shadow-2xl duration-300 sm:max-w-2xl">
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-950/60 p-5">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="truncate text-base font-extrabold text-white">
                                {selectedHistoryDetail.name || "Chi tiết video"}
                              </h3>
                            </div>
                            {selectedHistoryDetail.renderedAt && (
                              <p className="mt-0.5 font-mono text-xs text-slate-400">
                                ⏱️ Đã render lúc:{" "}
                                {new Date(selectedHistoryDetail.renderedAt).toLocaleString(
                                  "vi-VN",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  },
                                )}
                              </p>
                            )}
                          </div>

                          {/* Status Toggle on Drawer Header */}
                          <div className="flex items-center gap-3">
                            <PermissionGate module="history" action="edit">
                              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={selectedHistoryDetail.status === "used"}
                                  onClick={() => handleToggleHistoryStatus(selectedHistoryDetail)}
                                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    selectedHistoryDetail.status === "used"
                                      ? "bg-emerald-500"
                                      : "bg-slate-700"
                                  }`}
                                  title={
                                    selectedHistoryDetail.status === "used"
                                      ? "Bấm để đánh dấu là chưa sử dụng"
                                      : "Bấm để đánh dấu là đã sử dụng"
                                  }
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                      selectedHistoryDetail.status === "used"
                                        ? "translate-x-4"
                                        : "translate-x-0"
                                    }`}
                                  />
                                </button>
                                <span
                                  className={`text-xs font-semibold select-none ${
                                    selectedHistoryDetail.status === "used"
                                      ? "font-bold text-emerald-400"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {selectedHistoryDetail.status === "used"
                                    ? "Đã sử dụng"
                                    : "Chưa sử dụng"}
                                </span>
                              </div>
                            </PermissionGate>

                            <button
                              type="button"
                              onClick={() => setSelectedHistoryDetail(null)}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                              title="Đóng chi tiết"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        {/* Drawer Body */}
                        <div className="min-w-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto p-5 sm:p-6">
                          {/* Video Preview Player */}
                          {selectedHistoryDetail.payload ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
                                  <Play className="h-3.5 w-3.5 fill-current text-indigo-400" />
                                  <span>Màn hình xem lại video 9:16</span>
                                </h4>
                                {(selectedHistoryDetail.payload as ComposedVideo)
                                  ?.finalDuration && (
                                  <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
                                    Thời lượng:{" "}
                                    {(
                                      selectedHistoryDetail.payload as ComposedVideo
                                    ).finalDuration.toFixed(1)}
                                    s
                                  </span>
                                )}
                              </div>

                              <div className="flex justify-center rounded-2xl border border-slate-800 bg-slate-950 p-4">
                                {(() => {
                                  const comp = selectedHistoryDetail.payload as ComposedVideo;
                                  const vItem = comp?.voiceTrackId
                                    ? multiVoices.find((v) => v.id === comp.voiceTrackId)
                                    : null;
                                  const vTrack: VoiceTrack | null = vItem
                                    ? {
                                        id: vItem.id,
                                        name: vItem.name,
                                        fileName: vItem.fileName,
                                        localUrl: vItem.localUrl,
                                        localPath: vItem.localPath || "",
                                        sizeBytes: 0,
                                        duration: vItem.duration || 20,
                                        createdAt: "",
                                      }
                                    : null;
                                  return (
                                    <PreviewPlayer916
                                      composed={comp}
                                      sourceVideo={state.sourceVideo}
                                      voiceTrack={vTrack}
                                      enableVoice={Boolean(vTrack)}
                                    />
                                  );
                                })()}
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-8 text-center text-xs text-slate-500">
                              Bản ghi này thuộc phiên bản trước, không có snapshot cảnh để preview
                              trực tiếp.
                            </div>
                          )}

                          {/* 5 Cảnh Category Details */}
                          {(selectedHistoryDetail.payload as ComposedVideo)?.slots && (
                            <div className="space-y-3">
                              <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
                                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                                <span>Chi tiết 5 cảnh trong tổ hợp</span>
                              </h4>

                              <div className="space-y-2.5">
                                {(selectedHistoryDetail.payload as ComposedVideo).slots.map(
                                  (s, idx) => {
                                    const catMeta = SHOT_CATEGORIES.find(
                                      (c) => c.id === s.category,
                                    );
                                    const driveLink = getGoogleDriveLinkFromSlot(s);

                                    return (
                                      <div
                                        key={idx}
                                        className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                            <span
                                              className={`w-[72px] shrink-0 rounded border px-1.5 py-1 text-center text-[10px] font-extrabold tracking-wider uppercase ${
                                                catMeta?.badgeClass || "text-slate-300"
                                              }`}
                                            >
                                              {s.category}
                                            </span>
                                            <div className="min-w-0 flex-1 space-y-0.5">
                                              <div className="truncate font-semibold text-slate-200">
                                                {s.shotLabel || s.shotId}
                                              </div>
                                              <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                                                <span className="shrink-0">
                                                  Cắt gốc: {s.videoBegin.toFixed(1)}s →{" "}
                                                  {s.videoEnd.toFixed(1)}s
                                                </span>
                                                {driveLink ? (
                                                  <>
                                                    <span className="shrink-0 text-slate-600">
                                                      •
                                                    </span>
                                                    <a
                                                      href={driveLink}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="inline-flex max-w-[150px] items-center gap-1 truncate text-sky-400 hover:text-sky-300 hover:underline sm:max-w-[220px]"
                                                      title={`Mở video gốc trên Google Drive: ${driveLink}`}
                                                    >
                                                      <Cloud className="h-3 w-3 shrink-0 text-sky-400" />
                                                      <span className="truncate">{driveLink}</span>
                                                      <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                                    </a>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="shrink-0 text-slate-600">
                                                      •
                                                    </span>
                                                    <span className="shrink-0 text-slate-500 italic">
                                                      File máy tính
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
                                            {s.speed && s.speed !== 1 && (
                                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-amber-300">
                                                {s.speed}x
                                              </span>
                                            )}
                                            {s.flipH && (
                                              <span className="rounded border border-fuchsia-500/30 bg-fuchsia-500/10 px-1.5 py-0.5 text-fuchsia-300">
                                                Mirror
                                              </span>
                                            )}
                                            <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-slate-300">
                                              {(s.exitEnd - s.enterBegin).toFixed(1)}s
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  },
                                )}
                              </div>
                            </div>
                          )}

                          {/* Voice Track Details */}
                          {(selectedHistoryDetail.payload as ComposedVideo)?.voiceTrackId && (
                            <div className="space-y-2">
                              <h4 className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-slate-400 uppercase">
                                <Mic className="h-3.5 w-3.5 text-indigo-400" />
                                <span>Giọng lồng tiếng (Voiceover)</span>
                              </h4>
                              {(() => {
                                const vItem = multiVoices.find(
                                  (v) =>
                                    v.id ===
                                    (selectedHistoryDetail.payload as ComposedVideo).voiceTrackId,
                                );
                                const voiceDriveLink = getGoogleDriveLinkFromVoice(vItem);

                                return (
                                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="min-w-0 flex-1 space-y-0.5">
                                        <div className="truncate font-mono font-medium text-slate-200">
                                          🎙️ {vItem?.name || "Track lồng voice"}
                                        </div>
                                        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
                                          <span className="shrink-0 text-emerald-400">
                                            Đã hòa âm
                                          </span>
                                          {voiceDriveLink ? (
                                            <>
                                              <span className="shrink-0 text-slate-600">•</span>
                                              <a
                                                href={voiceDriveLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex max-w-[180px] items-center gap-1 truncate text-sky-400 hover:text-sky-300 hover:underline sm:max-w-[260px]"
                                                title={`Mở file voice trên Google Drive: ${voiceDriveLink}`}
                                              >
                                                <Cloud className="h-3 w-3 shrink-0 text-sky-400" />
                                                <span className="truncate">{voiceDriveLink}</span>
                                                <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                              </a>
                                            </>
                                          ) : (
                                            <>
                                              <span className="shrink-0 text-slate-600">•</span>
                                              <span className="shrink-0 text-slate-500 italic">
                                                File máy tính
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      <span className="shrink-0 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                                        Voiceover
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          {/* Tuple Key */}
                          <div className="flex max-w-full min-w-0 items-center gap-2 font-mono text-[11px] text-slate-500">
                            <p
                              className="min-w-0 flex-1 cursor-text truncate select-all"
                              title={`Mã tổ hợp: ${selectedHistoryDetail.tupleKey}`}
                            >
                              <span className="shrink-0">Mã tổ hợp: </span>
                              <span className="text-slate-400">
                                {selectedHistoryDetail.tupleKey}
                              </span>
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(selectedHistoryDetail.tupleKey);
                                addToast({
                                  type: "info",
                                  text: "Đã sao chép mã tổ hợp vào clipboard.",
                                });
                              }}
                              className="shrink-0 rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
                              title="Sao chép mã tổ hợp"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Drawer Footer Actions */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/80 p-5">
                          <div className="flex items-center gap-2">
                            {selectedHistoryDetail.payload && (
                              <button
                                type="button"
                                onClick={() => {
                                  handlePreviewHistoryComposed(selectedHistoryDetail);
                                  setSelectedHistoryDetail(null);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-500"
                              >
                                <Shuffle className="h-3.5 w-3.5" />
                                <span>Mở trên tab trộn ghép</span>
                              </button>
                            )}
                            {selectedHistoryDetail.payload && (
                              <PermissionGate module="history" action="export">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRenderSingleComposed(
                                      selectedHistoryDetail.payload as ComposedVideo,
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:bg-slate-700"
                                >
                                  <Download className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Tải lại MP4</span>
                                </button>
                              </PermissionGate>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedHistoryDetail(null)}
                            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                          >
                            Đóng
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Slide-over Drawer: Lịch sử & tra cứu link Google Drive */}
        {showDriveHistoryDrawer && (
          <div className="animate-in fade-in fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm duration-200">
            <div className="absolute inset-0" onClick={() => setShowDriveHistoryDrawer(false)} />
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <div className="animate-in slide-in-from-right pointer-events-auto flex w-screen max-w-2xl flex-col border-l border-slate-800 bg-slate-900 shadow-2xl duration-300">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/15 text-sky-400">
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">Lịch sử link Google Drive</h3>
                        <span className="rounded-full border border-sky-500/40 bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                          {allDriveLinks.length} link
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Toàn bộ link Google Drive đã nạp trong kho của dự án
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDriveHistoryDrawer(false)}
                    className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                    title="Đóng drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="space-y-3 border-b border-slate-800 bg-slate-900/60 p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={driveHistorySearchText}
                      onChange={(e) => setDriveHistorySearchText(e.target.value)}
                      placeholder="Tìm theo link Drive, File ID hoặc tên file..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pr-9 pl-9 text-xs text-slate-200 transition placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
                    />
                    {driveHistorySearchText && (
                      <button
                        type="button"
                        onClick={() => setDriveHistorySearchText("")}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                        title="Xóa tìm kiếm"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDriveHistoryCategoryFilter("all")}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        driveHistoryCategoryFilter === "all"
                          ? "bg-sky-600 text-white"
                          : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      Tất cả ({allDriveLinks.length})
                    </button>
                    {CATEGORY_ORDER.map((cat) => {
                      const count = allDriveLinks.filter((l) => l.category === cat).length;
                      const meta = SHOT_CATEGORIES.find((c) => c.id === cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setDriveHistoryCategoryFilter(cat)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                            driveHistoryCategoryFilter === cat
                              ? "bg-sky-600 text-white"
                              : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          }`}
                        >
                          {meta?.label || cat} ({count})
                        </button>
                      );
                    })}
                    {(() => {
                      const voiceCount = allDriveLinks.filter((l) => l.category === "voice").length;
                      return (
                        <button
                          type="button"
                          onClick={() => setDriveHistoryCategoryFilter("voice")}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                            driveHistoryCategoryFilter === "voice"
                              ? "bg-sky-600 text-white"
                              : "bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          }`}
                        >
                          Voice ({voiceCount})
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {/* Items List */}
                <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                  {filteredDriveLinks.length === 0 ? (
                    <div className="flex h-48 flex-col items-center justify-center space-y-2 p-4 text-center text-xs text-slate-400">
                      <Cloud className="h-8 w-8 text-slate-600" />
                      <div>Không tìm thấy link Google Drive nào phù hợp.</div>
                    </div>
                  ) : (
                    filteredDriveLinks.map((item) => {
                      const catMeta = SHOT_CATEGORIES.find((c) => c.id === item.category);
                      return (
                        <div
                          key={`${item.category}-${item.id}`}
                          className="space-y-2 rounded-xl border border-slate-800/90 bg-slate-950/80 p-3 transition hover:border-slate-700"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                  item.category === "voice"
                                    ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                                    : catMeta?.badgeClass || "border-slate-700 text-slate-200"
                                }`}
                              >
                                {item.category === "voice"
                                  ? "Voice"
                                  : catMeta?.label || item.category}
                              </span>
                              <span
                                className="truncate text-xs font-medium text-slate-200"
                                title={item.name}
                              >
                                {item.name}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              {item.duration > 0 && (
                                <span className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-xs text-slate-400">
                                  {item.duration.toFixed(1)}s
                                </span>
                              )}
                              <PermissionGate module="mix" action="edit">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.category === "voice") {
                                      handleRemoveVoiceItem(item.id);
                                    } else {
                                      handleRemoveCategoryItem(
                                        item.category as ShotCategory,
                                        item.id,
                                      );
                                    }
                                    addToast({
                                      type: "info",
                                      text: "Đã xóa clip khỏi kho.",
                                    });
                                  }}
                                  className="rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-rose-400"
                                  title="Xóa khỏi kho"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </PermissionGate>
                            </div>
                          </div>

                          {/* Link detail row */}
                          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/80 bg-slate-900/80 px-2.5 py-1.5 font-mono text-[11px]">
                            <a
                              href={item.driveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 truncate text-sky-400 hover:text-sky-300 hover:underline"
                              title={`Mở link trên Google Drive: ${item.driveUrl}`}
                            >
                              <Cloud className="h-3 w-3 shrink-0 text-sky-400" />
                              <span className="truncate">{item.driveUrl}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(item.driveUrl);
                                addToast({
                                  type: "info",
                                  text: "Đã sao chép link Google Drive vào clipboard.",
                                });
                              }}
                              className="inline-flex shrink-0 items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-slate-700 hover:text-white"
                              title="Sao chép link"
                            >
                              <Copy className="h-3 w-3" />
                              <span>Sao chép</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/90 p-4">
                  <span className="font-mono text-xs text-slate-400">
                    Hiển thị {filteredDriveLinks.length} / {allDriveLinks.length} link Drive
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDriveHistoryDrawer(false)}
                    className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Single Category Google Drive Paste Modal */}
        {singleCategoryDriveModal && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm duration-200">
            <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-500/20">
                    <Cloud className="h-4 w-4 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Dán link Google Drive cho mục{" "}
                      {singleCategoryDriveModal.category === "voice"
                        ? "Voice (lồng tiếng)"
                        : singleCategoryDriveModal.category.toUpperCase()}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Nhập danh sách link Google Drive công khai (mỗi dòng 1 link hoặc dấu phẩy)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSingleCategoryDriveModal(null)}
                  className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  title="Đóng modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <textarea
                rows={6}
                value={singleCategoryDriveModal.text}
                onChange={(e) =>
                  setSingleCategoryDriveModal({
                    ...singleCategoryDriveModal,
                    text: e.target.value,
                  })
                }
                placeholder="https://drive.google.com/file/d/1abc.../view&#10;https://drive.google.com/file/d/2xyz.../view"
                className="w-full resize-y rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-slate-200 transition placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-1">
                <button
                  type="button"
                  onClick={() => setSingleCategoryDriveModal(null)}
                  className="rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  disabled={!singleCategoryDriveModal.text.trim() || isIngestingDrive}
                  onClick={() =>
                    handleIngestSingleCategoryDrive(
                      singleCategoryDriveModal.category,
                      singleCategoryDriveModal.text,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 disabled:opacity-50"
                >
                  {isIngestingDrive ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>Nạp vào mục này</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear All Confirmation Modal */}
        {showClearConfirmModal && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm duration-200">
            <div className="animate-in zoom-in-95 relative w-full max-w-md space-y-5 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl duration-200">
              {/* Ambient subtle glow */}
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-rose-500/15 blur-3xl" />

              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Xác nhận xoá trắng kho</h3>
                  <p className="text-xs leading-relaxed text-slate-300">
                    Bạn có chắc chắn muốn xóa toàn bộ clip trong kho, các file voice và toàn bộ tổ
                    hợp đã tạo để bắt đầu mẻ mới?
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400">
                <div className="flex items-center gap-2 font-medium text-rose-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Các mục sẽ bị dọn sạch vĩnh viễn:</span>
                </div>
                <ul className="list-inside list-disc space-y-1 pl-1 text-slate-300">
                  <li>Toàn bộ clip trong 5 thư mục (Open, Product, Texture, Apply, End)</li>
                  <li>Toàn bộ file voice lồng tiếng đã nạp</li>
                  <li>Toàn bộ danh sách tổ hợp video đã tạo trong phiên này</li>
                  <li>Dữ liệu lưu trữ trong SQLite Cloud của dự án này</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-2">
                <button
                  type="button"
                  disabled={isClearingAll}
                  onClick={() => setShowClearConfirmModal(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isClearingAll}
                  onClick={handleConfirmClearAll}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-500 disabled:opacity-50"
                >
                  {isClearingAll ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>{isClearingAll ? "Đang xóa..." : "Xác nhận xóa sạch"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear Render History Confirmation Modal */}
        {showClearHistoryConfirmModal && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm duration-200">
            <div className="animate-in zoom-in-95 relative w-full max-w-md space-y-5 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl duration-200">
              {/* Ambient subtle glow */}
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-rose-500/15 blur-3xl" />

              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Xác nhận xóa toàn bộ lịch sử</h3>
                  <p className="text-xs leading-relaxed text-slate-300">
                    Bạn có chắc chắn muốn xóa toàn bộ lịch sử các video đã render của dự án này?
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400">
                <div className="flex items-center gap-2 font-medium text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Lưu ý quan trọng:</span>
                </div>
                <ul className="list-inside list-disc space-y-1 pl-1 text-slate-300">
                  <li>
                    Toàn bộ {renderedHistoryList.length} bản ghi video đã render sẽ bị xóa khỏi lịch
                    sử.
                  </li>
                  <li>
                    Sau khi xóa, các mẻ trộn tiếp theo có thể trùng với các clip/tổ hợp đã từng
                    render trước đây.
                  </li>
                  <li>Hành động này không thể hoàn tác.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-2">
                <button
                  type="button"
                  disabled={isClearingHistory}
                  onClick={() => setShowClearHistoryConfirmModal(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isClearingHistory}
                  onClick={handleConfirmClearHistory}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-500 disabled:opacity-50"
                >
                  {isClearingHistory ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>{isClearingHistory ? "Đang xóa..." : "Xác nhận xóa"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mark All Rendered Confirmation Modal */}
        {showMarkAllRenderedModal && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm duration-200">
            <div className="animate-in zoom-in-95 relative w-full max-w-md space-y-5 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl duration-200">
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-emerald-500/15 blur-3xl" />

              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
                  <CheckCheck className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">
                    Xác nhận đánh dấu tất cả đã render
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-300">
                    Bạn có chắc muốn đánh dấu toàn bộ {state?.composedVideos?.length || 0} video
                    trong danh sách tổ hợp này đã render?
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400">
                <div className="flex items-center gap-2 font-medium text-emerald-300">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  <span>Chi tiết thực hiện:</span>
                </div>
                <ul className="list-inside list-disc space-y-1 pl-1 text-slate-300">
                  <li>
                    {unrecordedComposedCount > 0
                      ? `Sẽ thêm ${unrecordedComposedCount} video mới vào lịch sử render (bỏ qua ${
                          (state?.composedVideos?.length || 0) - unrecordedComposedCount
                        } video đã có trong lịch sử).`
                      : "Toàn bộ video trong danh sách đều đã có trong lịch sử render."}
                  </li>
                  <li>
                    Hệ thống coi như bỏ qua bước tải MP4 về máy và lưu mã tổ hợp để tránh trùng lặp
                    ở các lần trộn tiếp theo.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-2">
                <button
                  type="button"
                  disabled={isMarkingAllRendered}
                  onClick={() => setShowMarkAllRenderedModal(false)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isMarkingAllRendered || unrecordedComposedCount === 0}
                  onClick={handleConfirmMarkAllRendered}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isMarkingAllRendered ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {isMarkingAllRendered
                      ? "Đang ghi nhận..."
                      : unrecordedComposedCount === 0
                        ? "Đã có trong lịch sử"
                        : "Đồng ý đánh dấu"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Single History Item Confirmation Modal */}
        {historyItemPendingDelete && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm duration-200">
            <div className="animate-in zoom-in-95 relative w-full max-w-md space-y-5 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900 p-6 shadow-2xl duration-200">
              <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-rose-500/15 blur-3xl" />

              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/15 text-rose-400">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Xác nhận xóa bản ghi video</h3>
                  <p className="text-xs leading-relaxed text-slate-300">
                    Bạn có chắc muốn xóa video{" "}
                    <span className="font-bold text-rose-300">
                      &quot;
                      {historyItemPendingDelete.name || historyItemPendingDelete.id}
                      &quot;
                    </span>{" "}
                    khỏi lịch sử render?
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] text-slate-400">
                <div className="flex items-center gap-2 font-medium text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Lưu ý quan trọng:</span>
                </div>
                <ul className="list-inside list-disc space-y-1 pl-1 text-slate-300">
                  <li>Bản ghi này sẽ bị xóa khỏi lịch sử render của dự án.</li>
                  <li>
                    Sau khi xóa, tổ hợp các cảnh này có thể xuất hiện lại ở các lần trộn tiếp theo.
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-800 pt-2">
                <button
                  type="button"
                  disabled={isDeletingHistoryItem}
                  onClick={() => setHistoryItemPendingDelete(null)}
                  className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  disabled={isDeletingHistoryItem}
                  onClick={handleConfirmDeleteHistoryItem}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-rose-600/25 transition hover:bg-rose-500 disabled:opacity-50"
                >
                  {isDeletingHistoryItem ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>{isDeletingHistoryItem ? "Đang xóa..." : "Xác nhận xóa"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Loading Overlay with Backdrop */}
        {busyMessage && (
          <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 backdrop-blur-md transition-all duration-200">
            <div className="animate-in zoom-in-95 relative flex w-full max-w-sm flex-col items-center gap-4 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/95 p-7 text-center shadow-2xl duration-200">
              {/* Ambient glowing radial effects */}
              <div className="pointer-events-none absolute -top-12 -left-12 h-36 w-36 rounded-full bg-rose-500/15 blur-3xl" />
              <div className="pointer-events-none absolute -right-12 -bottom-12 h-36 w-36 rounded-full bg-indigo-500/15 blur-3xl" />

              {/* Spinner with Loader2 */}
              <div className="relative my-1 flex items-center justify-center">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-800 border-t-rose-500" />
                <Loader2 className="absolute h-6 w-6 animate-spin text-rose-400" />
              </div>

              {/* Title and Detail */}
              <div className="z-10 w-full space-y-1.5">
                <h3 className="text-base font-semibold tracking-wide text-white">
                  {renderProgress ? "Đang kết xuất video..." : "Đang thực hiện..."}
                </h3>
                <p className="mx-auto max-w-xs font-mono text-xs leading-relaxed text-slate-300">
                  {busyMessage}
                </p>

                {/* Real-time Render Progress Tracker */}
                {renderProgress && (
                  <div className="w-full space-y-2 pt-2">
                    <div className="flex items-center justify-between px-1 font-mono text-xs font-bold">
                      <span className="text-emerald-400">
                        {renderProgress.current} / {renderProgress.total} video
                      </span>
                      <span className="font-extrabold text-indigo-400">
                        {renderProgress.percent}%
                      </span>
                    </div>
                    {renderProgress.name && (
                      <div className="mx-auto max-w-xs truncate text-[11px] text-slate-400">
                        Đang xử lý: <span className="text-slate-200">{renderProgress.name}</span>
                      </div>
                    )}
                    <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-700/60 bg-slate-800 p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 shadow-sm shadow-emerald-500/50 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, renderProgress.percent))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Real-time Upload Progress Tracker */}
                {uploadProgress && (
                  <div className="w-full space-y-2 pt-2">
                    <div className="flex items-center justify-between px-1 font-mono text-xs font-bold">
                      <span className="text-emerald-400">
                        {(uploadProgress.loadedBytes / 1024 / 1024).toFixed(1)} /{" "}
                        {(uploadProgress.totalBytes / 1024 / 1024).toFixed(1)} MB
                      </span>
                      <span className="font-extrabold text-indigo-400">
                        {uploadProgress.percent}%
                      </span>
                    </div>
                    {uploadProgress.fileName && (
                      <div className="mx-auto max-w-xs truncate text-[11px] text-slate-400">
                        Đang nạp:{" "}
                        <span className="font-medium text-slate-200">
                          {uploadProgress.fileName}
                        </span>
                      </div>
                    )}
                    <div className="h-2.5 w-full overflow-hidden rounded-full border border-slate-700/60 bg-slate-800 p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-indigo-500 shadow-sm shadow-rose-500/50 transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, uploadProgress.percent))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Default animated progress bar pulse if no renderProgress and no uploadProgress */}
              {!renderProgress && !uploadProgress && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-800/80">
                  <div className="h-full w-full animate-pulse bg-gradient-to-r from-rose-500 via-indigo-500 to-indigo-600" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Floating Toast Notifications */}
        <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex w-full max-w-sm flex-col gap-2.5 sm:max-w-md">
          {toasts.map((toast) => {
            const isSuccess = toast.type === "success";
            const isError = toast.type === "error";
            const isForbidden = toast.type === "forbidden";

            return (
              <div
                key={toast.id}
                className={`animate-in slide-in-from-bottom-5 pointer-events-auto flex translate-y-0 transform items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur-md transition-all duration-300 ${
                  isForbidden
                    ? "border-amber-500/50 bg-slate-900/95 text-amber-100 shadow-amber-950/40"
                    : isSuccess
                      ? "border-emerald-500/40 bg-slate-900/95 text-emerald-100 shadow-emerald-950/40"
                      : isError
                        ? "border-rose-500/40 bg-slate-900/95 text-rose-100 shadow-rose-950/40"
                        : "border-sky-500/40 bg-slate-900/95 text-sky-100 shadow-sky-950/40"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isForbidden && <ShieldAlert className="h-4 w-4 text-amber-400" />}
                  {!isForbidden && isSuccess && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  {!isForbidden && isError && <AlertTriangle className="h-4 w-4 text-rose-400" />}
                  {!isForbidden && !isSuccess && !isError && (
                    <Info className="h-4 w-4 text-sky-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5 text-xs leading-relaxed">
                  <p
                    className={`font-semibold ${isForbidden ? "text-amber-300" : "text-slate-100"}`}
                  >
                    {toast.title ||
                      (isForbidden
                        ? "Từ chối truy cập (403)"
                        : isSuccess
                          ? "Thành công"
                          : isError
                            ? "Có lỗi xảy ra"
                            : "Thông báo")}
                  </p>
                  <p className="text-[11px] break-words whitespace-pre-wrap text-slate-300">
                    {toast.text}
                  </p>
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="shrink-0 rounded-lg p-0.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                  title="Đóng thông báo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {showShareModal && parentProjectIdState && (
        <ShareProjectModal
          projectId={parentProjectIdState}
          projectName={parentProjectNameState || "Dự án"}
          onClose={() => setShowShareModal(false)}
          onToast={addToast}
        />
      )}
    </ProjectAccessProvider>
  );
}
