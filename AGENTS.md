# Quy định & Hướng dẫn dành cho AI Agents (AGENTS.md)

Tài liệu này ghi chú các quy chuẩn bắt buộc mà toàn bộ AI Agents / Developers phải tuân thủ nghiêm ngặt khi phát triển, chỉnh sửa và tạo mới code trong dự án **Lachvid Studio**.

> [!IMPORTANT]
> Đọc [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) để nắm rõ kiến trúc **Domain Modeling Made Functional (DMMF) + Functional Programming (FP)** và [docs/refactor/PLAN.md](docs/refactor/PLAN.md) để biết lộ trình refactor.

---

## 1. Quy tắc viết hoa tiêu đề & UI Text (Title & Header Capitalization)

> [!IMPORTANT]
> **Tuyệt đối KHÔNG viết hoa từng chữ theo kiểu Capital Case (Title Case) trong tiếng Việt.**
> Toàn bộ UI (tiêu đề, heading, nhãn nút, thẻ card, modal, tooltip, thông báo trạng thái) phải sử dụng **Sentence case**.

## 3. Tech Stack & Cấu hình dự án Lachvid Studio

- **Package manager**: `yarn` (1.22.x), Node 22 LTS (`.nvmrc`) — không dùng `npm` hay `package-lock.json`
- **Next.js**: 16.4.3 (Turbopack, `src/proxy.ts` thay `middleware.ts`)
- **React**: 19.3.1 (React automatic runtime & React Hooks rule)
- **Font**: GeistSans (`geist/font/sans`) & GeistMono (`geist/font/mono`)
- **Styling & UI**: Tailwind CSS v4 + HeroUI v3 (`@heroui/react`, `@heroui/styles`) bọc trong `src/shared/ui`
- **Effect**: `effect` **4.x** (Workflow, DI, Schema, Data, Either, Option, Match)
- **Forms & URL state**: `react-hook-form` + `@hookform/resolvers` (với Effect Schema), `nuqs`
- **Linting & Formatting**: ESLint 9 (`eslint.config.mjs`) + Prettier (`prettier-plugin-tailwindcss`)
- **Testing**: Vitest 5 (`@effect/vitest`, `fast-check`, `@testing-library/react`) + Playwright

---

## 4. Kiến trúc DMMF + FP (bắt buộc cho code mới)

1. **Bounded contexts & phân lớp**:
   - `src/contexts/<context>/domain/` — type + hàm thuần (Schema, Data, Option, Either, Match). **Không I/O, không Effect service, không `Date.now()` / `Math.random()` / `crypto.randomUUID()`, không `node:*` / `next/*`.**
   - `src/contexts/<context>/workflows/` — `Effect.gen`: validate → load (qua port) → decide (domain) → persist → events. Dependency khai báo bằng `Context.Tag` (port).
   - `src/contexts/<context>/adapters/` — `Layer` hiện thực port (SQL thô, Python, Zvid, Drive, FS), chứa Schema DTO và mapping `DTO ↔ domain` (Anti-Corruption Layer).
   - `src/contexts/<context>/ui/` — component, hook, reducer (gọi hàm domain), server action mỏng.
   - `src/platform/` — `runtime.ts`, `run.ts` (`runQuery`, `makeAction`, `runRoute`), `config.ts`, `sql/`, `http/`.
   - `src/shared/` — `ui/` (wrapper HeroUI) và `lib/` thuần.
2. **Quy tắc phụ thuộc** (đã enforce bằng `eslint-plugin-boundaries`):
   - `domain` chỉ import `shared-kernel` và `effect`.
   - `workflows` chỉ import `shared-kernel`, `domain` cùng context, và `effect`.
   - Context A chỉ dùng context B qua `src/contexts/<B>/index.ts` hoặc domain events.
3. **Ngôn ngữ chung (Ubiquitous Language)**:
   - Đặt tên type/hàm/file theo glossary trong `docs/ARCHITECTURE.md` (ví dụ: `Project` = parent project, `Folder` = workspace studio). Không dùng tên chung chung (`data`, `item`, `info`, `manager`).
4. **Make illegal states unrepresentable**:
   - Dùng union theo trạng thái (`Data.TaggedEnum` / `Schema.TaggedStruct`) thay cho cờ boolean hoặc nhiều field optional.
   - Dùng branded types (`Schema.brand`) cho ID và giá trị có ràng buộc (`Seconds`, `Speed`, `ZoomDepth`).
   - Dùng `Option` thay `null | undefined` trong `domain/`.
5. **Functional Programming**:
   - Bất biến (`readonly`, `ReadonlyArray`), không `let`, không vòng lặp mutate trong `domain/`, xử lý union bắt buộc exhaustive (`Match.exhaustive` / `switch-exhaustiveness-check`).
   - Cấm `throw` trong `domain/`, `workflows/`, `platform/` — dùng `Data.TaggedError` + `Either` / kênh lỗi `E` của Effect.
6. **Effect Schema thay Zod**:
   - Tuyệt đối **cấm `zod`** (đã chặn ở ESLint). Effect Schema là nguồn duy nhất cho validation và TypeScript types (`typeof MySchema.Type`). DTO và Domain là 2 schema tách biệt.

---

## 5. Quy tắc Next.js, UI & Testing

1. **Server-first**: mặc định là React Server Component (RSC). `"use client"` chỉ đặt ở component lá có tương tác. Không `fetch("/api/...")` trong `useEffect` để load dữ liệu ban đầu.
2. **Server Actions vs Route Handlers**:
   - Mutation dùng Server Action mỏng bọc qua `makeAction(Schema, workflow)`.
   - Chỉ giữ Route Handler cho: stream media/Range (`media/[...path]`, `drive-stream/[fileId]`), webhook (`webhooks/zvid`), polling (`render-progress`), upload file lớn (`upload-local`).
3. **Form & URL state**: Form dùng `react-hook-form` + `useActionForm` với cùng Effect Schema của action. URL state (tab, filter, item đang chọn) dùng `nuqs`.
4. **UI (100% HeroUI v3 qua `src/shared/ui`)**:
   - Mọi component UI trong `src/contexts/*/ui/**` **bắt buộc** dùng wrapper từ `src/shared/ui` (bọc `@heroui/react` v3) và `lucide-react` cho icon.
   - **Tuyệt đối CẤM** dùng thẻ HTML thuần cho UI controls/typography trong `src/contexts/**`: `<button>`, `<select>`, `<textarea>`, `<label>`, `<h1>`–`<h6>`, `<p>`, và `<input>` hiển thị.
   - Ngoại lệ duy nhất: thẻ media (`<video>`, `<audio>`), `<input type="file" | "hidden">` ẩn, và track kéo-thả pointer tùy biến (`IPhoneVideoTrimmer`, thanh timeline phân đoạn).
   - Quy tắc này được kiểm tra tự động qua ESLint `no-restricted-syntax`.
5. **Code style**: Named export (trừ `page.tsx`, `layout.tsx`, `error.tsx`, `loading.tsx`); **mỗi component / file không được quá 600 dòng code** (bắt buộc tách nhỏ thành sub-component khi vượt ngưỡng; khuyến khích giữ ≤ 300 dòng).
6. **Testing**: Mọi thay đổi ở `domain/`, `workflows/`, `adapters/` phải kèm unit/property/integration test và đạt ngưỡng coverage của module trong `vitest.config.mts`.
7. **Kiểm tra bắt buộc trước khi hoàn thành task**:
   ```bash
   yarn lint && yarn typecheck && yarn test
   ```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
