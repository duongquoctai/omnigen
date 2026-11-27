"use client";

import { Clapperboard, Film, Layers, Scissors } from "lucide-react";

import { Heading, Text } from "@/shared/ui";

const INTRO_FEATURES = [
  {
    icon: Scissors,
    label: "Tách cảnh thông minh & phân loại kho clip",
  },
  {
    icon: Layers,
    label: "Trộn ghép & lồng tiếng hàng loạt chuẩn 9:16",
  },
  {
    icon: Clapperboard,
    label: "Render tự động, quản lý dự án & chia sẻ nhóm",
  },
] as const;

export function AuthIntroPanel() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#10131e] p-10 xl:p-16">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(99,102,241,0.12),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(244,63,94,0.1),transparent_55%)]" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-rose-500 to-indigo-500 shadow-lg shadow-indigo-500/25">
            <Film className="h-6 w-6 text-white" />
          </div>
          <Text variant="body" className="text-2xl font-extrabold tracking-tight text-white">
            OmniGen
          </Text>
        </div>

        <Heading
          level={2}
          className="text-3xl leading-tight font-bold tracking-tight text-white xl:text-[34px]"
        >
          Sản xuất video{" "}
          <span className="bg-gradient-to-r from-rose-400 to-indigo-400 bg-clip-text text-transparent">
            hàng loạt
          </span>{" "}
          thật dễ dàng.
        </Heading>

        <Text as="p" variant="body" className="mt-4 max-w-xs leading-relaxed text-zinc-400">
          Tách cảnh, trộn ghép 9:16 và render tự động — tất cả trong một studio duy nhất.
        </Text>

        <ul className="mt-9 w-full space-y-4 text-left">
          {INTRO_FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-400/20 bg-indigo-500/15 text-indigo-300 shadow-sm shadow-indigo-500/10">
                <Icon className="h-4 w-4" />
              </div>
              <Text variant="body" className="text-sm text-zinc-300">
                {label}
              </Text>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
