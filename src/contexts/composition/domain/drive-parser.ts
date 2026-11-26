import { Option } from "effect";

import { SHOT_CATEGORY_VALUES, type ShotCategory } from "@/contexts/shared-kernel";

import type { DriveFileId } from "./types";

export const extractGoogleDriveFileId = (rawInput: string): Option.Option<DriveFileId> => {
  const trimmed = rawInput.trim();
  if (!trimmed) return Option.none();

  if (/^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) {
    return Option.some(trimmed as DriveFileId);
  }

  const fileDMatch = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(trimmed);
  const fileDId = fileDMatch?.at(1);
  if (fileDId) return Option.some(fileDId as DriveFileId);

  const idParamMatch = /[?&]id=([a-zA-Z0-9_-]+)/.exec(trimmed);
  const idParam = idParamMatch?.at(1);
  if (idParam) return Option.some(idParam as DriveFileId);

  const ucMatch = /\/uc\?.*id=([a-zA-Z0-9_-]+)/.exec(trimmed);
  const ucId = ucMatch?.at(1);
  if (ucId) return Option.some(ucId as DriveFileId);

  return Option.none();
};

export type ParsedFiveColumnLinks = Readonly<Record<ShotCategory, ReadonlyArray<string>>>;

export type ParsedSixColumnLinks = ParsedFiveColumnLinks & {
  readonly voice: ReadonlyArray<string>;
};

export const parseExcelSixColumnClipboard = (text: string): ParsedSixColumnLinks => {
  const initial: Record<ShotCategory, ReadonlyArray<string>> & {
    readonly voice: ReadonlyArray<string>;
  } = {
    open: [],
    product: [],
    texture: [],
    apply: [],
    end: [],
    voice: [],
  };

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  return lines.reduce((acc, line) => {
    const cells = line.split("\t");
    const withCats = SHOT_CATEGORY_VALUES.reduce((rowAcc, cat, idx) => {
      const cell = (cells.at(idx) ?? "").trim();
      if (!cell || !Option.isSome(extractGoogleDriveFileId(cell))) {
        return rowAcc;
      }
      return {
        ...rowAcc,
        [cat]: [...rowAcc[cat], cell],
      };
    }, acc);

    const voiceCell = (cells.at(5) ?? "").trim();
    if (!voiceCell || !Option.isSome(extractGoogleDriveFileId(voiceCell))) {
      return withCats;
    }
    return {
      ...withCats,
      voice: [...withCats.voice, voiceCell],
    };
  }, initial);
};

export const parseExcelFiveColumnClipboard = (text: string): ParsedFiveColumnLinks => {
  const { open, product, texture, apply, end } = parseExcelSixColumnClipboard(text);
  return { open, product, texture, apply, end };
};
