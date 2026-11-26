# Ngôn ngữ chung (Ubiquitous Language)

Tài liệu này định nghĩa thuật ngữ bắt buộc dùng thống nhất trong `src/contexts/**`, tài liệu thiết kế và giao tiếp. Tên file, type, hàm trong `domain/` và `workflows/` phải bám sát bảng này; tránh dùng tên chung chung (`data`, `item`, `info`, `manager`).

> [!IMPORTANT]
> Trong code cũ, thuật ngữ bị xung đột: bảng/route `project` thực chất là **Folder** (workspace studio), còn `parent_project` mới là **Project** người dùng nhìn thấy. Từ tầng domain trở lên bắt buộc dùng đúng nghĩa dưới đây; việc chuyển đổi sang tên cột/bảng cũ nằm trong `adapters/`.

## 1. Bảng thuật ngữ chính

| Thuật ngữ (code)   | Tiếng Việt            | Định nghĩa                                                                   | Tên cũ trong code                        | Context       |
| ------------------ | --------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- | ------------- |
| `Project`          | Dự án                 | Nhóm cao nhất, có chủ sở hữu, chứa nhiều folder, đơn vị chia sẻ chính        | `ParentProject`, `parent-projects`       | Workspace     |
| `Folder`           | Thư mục làm việc      | Một workspace studio độc lập (split/mix/history) thuộc một `Project`         | `Project`, `ProjectMeta`, `project/[id]` | Workspace     |
| `SourceVideo`      | Video nguồn           | Video gốc người dùng upload để tách cảnh                                     | `SourceVideo`                            | Footage       |
| `Scene`            | Cảnh phát hiện        | Đoạn thô do PySceneDetect trả về, chưa chỉnh sửa                             | `rawBegin`/`rawEnd`                      | Footage       |
| `DraftShot`        | Shot nháp             | Shot chưa gán `ShotCategory`, chưa đủ điều kiện publish                      | `Shot` (`category: null`)                | Footage       |
| `ClassifiedShot`   | Shot đã phân loại     | Shot đã gán `ShotCategory`, có thể xuất hoặc publish                         | `Shot` (`category !== null`)             | Footage       |
| `ShotCategory`     | Nhóm cảnh             | `open`, `product`, `texture`, `apply`, `end`                                 | `ShotCategory`                           | Shared Kernel |
| `MinDuration`      | Thời lượng tối thiểu  | Thời lượng tối thiểu (giây) cho từng `ShotCategory`; thiếu sẽ tự slow-motion | `CategoryMinDurations`                   | Footage       |
| `Clip`             | Clip thư viện         | Một đoạn video thuộc một `ShotCategory` trong thư viện của `Folder`          | `CategoryVideoItem`                      | Composition   |
| `ClipLibrary`      | Thư viện clip         | 5 pool clip tương ứng 5 `ShotCategory`                                       | `CategoryPools`                          | Composition   |
| `VoiceClip`        | Voice                 | File âm thanh giọng đọc dùng để ghép với video                               | `MultiVoiceItem`, `VoiceTrack`           | Composition   |
| `DiversityRules`   | Luật đa dạng          | Cấu hình số video, Hamming tối thiểu, tần suất tối đa, thời lượng đích, seed | `DiversityConfig`                        | Composition   |
| `CompositionTuple` | Bộ 5 clip             | Tổ hợp 5 `ClipId` (mỗi category 1 clip) định danh duy nhất một video ghép    | `tupleKey`, `shotIds`                    | Composition   |
| `PlannedVideo`     | Video đã lên kế hoạch | Kết quả của `planMix`, gồm 5 slot, timeline, voice và `SyncMode`             | `ComposedVideo` (khi `draft`)            | Composition   |
| `SyncMode`         | Chế độ đồng bộ        | `VoiceMaster`, `VideoMaster`, `ShorterWins`                                  | `AudioVideoSyncMode`                     | Composition   |
| `RenderJob`        | Job render            | Vòng đời render một `PlannedVideo` qua Zvid                                  | `ComposedVideo.renderState`              | Rendering     |
| `RenderedRecord`   | Bản ghi đã render     | Video đã hoàn thành lưu trong lịch sử, trạng thái `Unused` / `Used`          | `RenderedVideoRecord`                    | Rendering     |
| `Actor`            | Người thực hiện       | Người dùng đã xác thực thực hiện một command/query                           | `User`, `SessionPayload`                 | Access        |
| `AccessRole`       | Vai trò truy cập      | `Owner`, `Collaborator`, `NoAccess`                                          | `role` + `isOwner` + `canManageFolders`  | Access        |
| `ModulePermission` | Quyền theo module     | Quyền `view`/`export`/`edit` trên từng module `split`/`mix`/`history`        | `ModulePermissionConfig`                 | Access        |
| `Share`            | Chia sẻ               | Quyền cấp cho người khác qua tài khoản hoặc email (pending nếu chưa đăng ký) | `ResourceShare`                          | Access        |
