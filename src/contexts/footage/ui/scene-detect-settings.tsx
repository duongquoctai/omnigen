"use client";

import { NumberInput, SelectField } from "@/shared/ui";

export interface SceneDetectConfig {
  readonly detector: "content" | "adaptive";
  readonly threshold: number;
  readonly minSceneLen: number;
}

export interface SceneDetectSettingsProps {
  readonly config: SceneDetectConfig;
  readonly disabled?: boolean | undefined;
  readonly onChange: (next: SceneDetectConfig) => void;
}

export function SceneDetectSettings({
  config,
  disabled = false,
  onChange,
}: SceneDetectSettingsProps) {
  return (
    <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-3">
      <SelectField
        label="Thuật toán tách cảnh"
        isDisabled={disabled}
        value={config.detector}
        onValueChange={(raw) => {
          const val = raw === "adaptive" ? "adaptive" : "content";
          onChange({
            ...config,
            detector: val,
            threshold: val === "adaptive" ? 3 : 27,
          });
        }}
        options={[
          { value: "content", label: "Content (chuẩn)" },
          { value: "adaptive", label: "Adaptive (chuyển động mượt)" },
        ]}
      />

      <NumberInput
        label={`Ngưỡng nhạy (${String(config.threshold)})`}
        step={config.detector === "adaptive" ? 0.5 : 1}
        min={1}
        max={100}
        isDisabled={disabled}
        value={config.threshold}
        onValueChange={(val) => {
          if (val >= 1) {
            onChange({ ...config, threshold: val });
          }
        }}
      />

      <NumberInput
        label="Độ dài cảnh tối thiểu (giây)"
        step={0.1}
        min={0.2}
        max={10}
        isDisabled={disabled}
        value={config.minSceneLen}
        onValueChange={(val) => {
          if (val >= 0.2) {
            onChange({ ...config, minSceneLen: val });
          }
        }}
      />
    </div>
  );
}
