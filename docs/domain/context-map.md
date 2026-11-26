# Bounded Contexts & Context Map

## 1. Phân loại context

| Context         | Vai trò    | Mức DMMF               | Trách nhiệm chính                                                                                       |
| --------------- | ---------- | ---------------------- | ------------------------------------------------------------------------------------------------------- |
| **Footage**     | Core       | Đầy đủ                 | Upload `SourceVideo`, phát hiện `Scene`, chỉnh sửa/phân loại `Shot`, cắt và publish sang thư viện       |
| **Composition** | Core       | Đầy đủ                 | Quản lý `ClipLibrary`, `VoiceClip`, ingest từ Drive/Excel, chạy thuật toán `planMix` tạo `PlannedVideo` |
| **Rendering**   | Core       | Đầy đủ (state machine) | Validate, submit và theo dõi `RenderJob` trên Zvid, quản lý `RenderedRecord` (history)                  |
| **Access**      | Supporting | Vừa                    | Xác thực `Actor`, quản lý `Share`, tính `AccessRole` và kiểm tra quyền `canPerform`                     |
| **Workspace**   | Generic    | Nhẹ                    | CRUD `Project` và `Folder`, điều hướng studio shell                                                     |

## 2. Context Map

```mermaid
flowchart LR
  subgraph Core
    F["Footage"]
    C["Composition"]
    R["Rendering"]
  end
  subgraph Supporting
    A["Access"]
    W["Workspace"]
  end
  PY["Python Scene Service (:3006)"]
  Z["Zvid API"]
  D["Google Drive"]

  F -->|"ShotsPublished (Event)"| C
  C -->|"PlannedVideo (DTO công khai)"| R
  R -->|"RenderedTuples (Query)"| C
  A -.->|"AccessRole / canPerform"| F
  A -.->|"AccessRole / canPerform"| C
  A -.->|"AccessRole / canPerform"| R
  A -.->|"AccessRole / canPerform"| W
  W -.->|"FolderId"| F
  F ---|"ACL"| PY
  C ---|"ACL"| D
  R ---|"ACL"| Z
```

## 3. Shared Kernel (`src/contexts/shared-kernel`)

Chỉ chứa các kiểu giá trị tối thiểu dùng chung giữa các context:

- Branded IDs: `ProjectId`, `FolderId`, `UserId`, `SourceVideoId`, `ShotId`, `ClipId`, `VoiceId`, `RenderJobId`
- Value objects: `ShotCategory`, `Seconds`, `MediaUrl`, `LocalPath`, `ContentHash`

Mọi thay đổi vào `shared-kernel` ảnh hưởng tất cả context, nên giữ kích thước nhỏ nhất có thể.
