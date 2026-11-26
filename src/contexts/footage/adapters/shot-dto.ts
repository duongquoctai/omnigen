import { Match, Option, Schema } from "effect";

import {
  ContentHash,
  Seconds,
  ShotCategory,
  ShotId,
  SourceVideoId,
} from "@/contexts/shared-kernel";

import {
  type Shot,
  Speed,
  type TimeRange,
  TransitionDuration,
  XFadeEffect,
  ZoomDepth,
} from "../domain/types";

export const LegacyShotDto = Schema.Struct({
  id: Schema.String,
  sourceVideoId: Schema.String,
  label: Schema.String,
  begin: Schema.Number,
  end: Schema.Number,
  rawBegin: Schema.optional(Schema.Number),
  rawEnd: Schema.optional(Schema.Number),
  category: Schema.NullOr(ShotCategory),
  contentHash: Schema.optional(Schema.String),
  edits: Schema.Struct({
    flipH: Schema.Boolean,
    lockFlipH: Schema.optional(Schema.Boolean),
    speed: Schema.Number,
    zoom: Schema.Union([Schema.Boolean, Schema.Struct({ depth: Schema.Number })]),
    transition: Schema.optional(Schema.NullOr(XFadeEffect)),
    transitionDuration: Schema.optional(Schema.Number),
  }),
});
export type LegacyShotDto = typeof LegacyShotDto.Type;

export const shotFromLegacyDto = (dto: LegacyShotDto): Shot => {
  const begin = Math.max(0, dto.begin) as Seconds;
  const end = Math.max(begin + 0.1, dto.end) as Seconds;
  const rawBegin = Math.max(0, dto.rawBegin ?? dto.begin) as Seconds;
  const rawEnd = Math.max(rawBegin + 0.1, dto.rawEnd ?? dto.end) as Seconds;

  const zoom =
    typeof dto.edits.zoom === "boolean"
      ? dto.edits.zoom
        ? ({ _tag: "AutoZoom" } as const)
        : ({ _tag: "NoZoom" } as const)
      : ({
          _tag: "FixedZoom",
          depth: Math.min(10, Math.max(1, dto.edits.zoom.depth)) as ZoomDepth,
        } as const);

  const locked = Boolean(dto.edits.lockFlipH);
  const flip = dto.edits.flipH
    ? ({ _tag: "Flipped", locked } as const)
    : ({ _tag: "Unflipped", locked } as const);

  const transition = dto.edits.transition
    ? ({
        _tag: "XFadeTransition",
        effect: dto.edits.transition,
        duration: Math.min(
          1.5,
          Math.max(0.3, dto.edits.transitionDuration ?? 0.4),
        ) as TransitionDuration,
      } as const)
    : ({ _tag: "NoTransition" } as const);

  const base = {
    id: dto.id as ShotId,
    sourceVideoId: dto.sourceVideoId as SourceVideoId,
    label: dto.label,
    range: { begin, end } as TimeRange,
    detectedRange: { begin: rawBegin, end: rawEnd } as TimeRange,
    contentHash: dto.contentHash ? Option.some(dto.contentHash as ContentHash) : Option.none(),
    edits: {
      flip,
      speed: Math.min(10, Math.max(0.1, dto.edits.speed)) as Speed,
      zoom,
      crop: Option.none(),
      transition,
    },
  };

  if (dto.category === null) {
    return { _tag: "DraftShot", ...base };
  }
  return { _tag: "ClassifiedShot", ...base, category: dto.category };
};

export const shotToLegacyDto = (shot: Shot): LegacyShotDto => ({
  id: shot.id,
  sourceVideoId: shot.sourceVideoId,
  label: shot.label,
  begin: shot.range.begin,
  end: shot.range.end,
  rawBegin: shot.detectedRange.begin,
  rawEnd: shot.detectedRange.end,
  category: shot._tag === "ClassifiedShot" ? shot.category : null,
  ...(Option.isSome(shot.contentHash) ? { contentHash: shot.contentHash.value } : {}),
  edits: {
    flipH: shot.edits.flip._tag === "Flipped",
    lockFlipH: shot.edits.flip.locked,
    speed: shot.edits.speed,
    zoom: Match.value(shot.edits.zoom).pipe(
      Match.tag("NoZoom", () => false),
      Match.tag("AutoZoom", () => true),
      Match.tag("FixedZoom", ({ depth }) => ({ depth })),
      Match.exhaustive,
    ),
    transition:
      shot.edits.transition._tag === "XFadeTransition" ? shot.edits.transition.effect : null,
    ...(shot.edits.transition._tag === "XFadeTransition"
      ? { transitionDuration: shot.edits.transition.duration }
      : {}),
  },
});
