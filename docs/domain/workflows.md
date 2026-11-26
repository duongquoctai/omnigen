# Chữ ký Workflow (P1.0)

Mỗi workflow là một pipeline thuần-ở-giữa: `UnvalidatedCommand → Effect<Events, Errors, Ports>`.

---

## 1. Footage context

```
workflow "Detect scenes"
  input:  DetectScenesCommand { folderId, sourceVideoId }
  cần:    FootageRepo, SceneDetector
  output: ScenesDetected { folderId, sourceVideoId, scenes: ReadonlyArray<Scene> }
  lỗi:    SourceVideoNotFound | SceneDetectionFailed | PersistenceError

workflow "Slice shots"
  input:  SliceShotsCommand { folderId, shots: NonEmptyArray<Shot> }
  cần:    FootageRepo, ShotSlicer
  output: ShotsSliced { folderId, files: NonEmptyArray<SlicedClipFile> }
  lỗi:    NoShotsToSlice | SlicingFailed | PersistenceError

workflow "Publish shots to library"
  input:  PublishShotsCommand { folderId, shotIds: NonEmptyArray<ShotId> }
  cần:    FootageRepo, ShotSlicer
  output: ShotsPublished { folderId, shots: NonEmptyArray<PublishedShot> }
  lỗi:    UnclassifiedShotError | ShotNotFound | SlicingFailed | PersistenceError
```

---

## 2. Composition context

```
workflow "Ingest Google Drive links"
  input:  IngestDriveLinksCommand { folderId, byCategory: Record<ShotCategory, ReadonlyArray<RawDriveLink>> }
  cần:    DriveProbe, ClipLibraryRepo
  output: ClipsAdded { folderId, clips: ReadonlyArray<Clip> }
  lỗi:    InvalidDriveLink | DriveProbeFailed | PersistenceError

workflow "Plan diverse mix"
  input:  PlanMixCommand { folderId, rules: UnvalidatedDiversityRules, syncMode: SyncMode }
  cần:    ClipLibraryRepo, VoiceLibraryRepo, RenderedTuplesQuery, PlannedVideoRepo
  output: MixPlanned { folderId, videos: NonEmptyArray<PlannedVideo> }
  lỗi:    InvalidDiversityRules | LibraryIncomplete(missingCategories) | NotEnoughCombinations(requested, possible) | PersistenceError

workflow "Handle ShotsPublished"
  input:  ShotsPublished (Event từ Footage)
  cần:    ClipLibraryRepo
  output: ClipsAdded
  lỗi:    PersistenceError
```

---

## 3. Rendering context

```
workflow "Validate render job"
  input:  ValidateRenderCommand { folderId, plannedVideoId }
  cần:    RenderJobRepo, ZvidGateway
  output: RenderValidated { jobId, creditsRequired }
  lỗi:    RenderJobNotFound | InvalidJobTransition | ZvidValidationFailed | PersistenceError

workflow "Submit render job"
  input:  SubmitRenderCommand { folderId, jobId, now: Date }
  cần:    RenderJobRepo, MediaUploader, ZvidGateway
  output: RenderSubmitted { jobId, providerJobId }
  lỗi:    RenderJobNotFound | InvalidJobTransition | MediaUploadFailed | ZvidSubmitFailed | PersistenceError

workflow "Apply provider update" (dùng chung cho webhook & polling)
  input:  ProviderUpdateCommand { providerJobId, status, progress?, outputUrl?, error?, now: Date }
  cần:    RenderJobRepo, MediaStorage, RenderedHistoryRepo
  output: RenderProgressed | RenderSucceeded | RenderFailed
  lỗi:    RenderJobNotFound | InvalidJobTransition | MediaDownloadFailed | PersistenceError

workflow "Mark rendered record used"
  input:  MarkRecordUsedCommand { folderId, recordId, used: boolean }
  cần:    RenderedHistoryRepo
  output: RecordStatusChanged { recordId, status }
  lỗi:    RecordNotFound | PersistenceError
```
