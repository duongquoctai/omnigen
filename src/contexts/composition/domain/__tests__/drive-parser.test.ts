import { describe, expect, it } from "vitest";

import { parseExcelFiveColumnClipboard, parseExcelSixColumnClipboard } from "../drive-parser";

describe("composition/domain/drive-parser", () => {
  it("parses 6-column Excel clipboard including column 6 for voices", () => {
    const id1 = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345";
    const id2 = "2aBcDeFgHiJkLmNoPqRsTuVwXyZ12345";
    const idVoice = "9aBcDeFgHiJkLmNoPqRsTuVwXyZ12345";
    const row = [
      `https://drive.google.com/file/d/${id1}/view`,
      `https://drive.google.com/file/d/${id2}/view`,
      "",
      "",
      "",
      `https://drive.google.com/file/d/${idVoice}/view`,
    ].join("\t");

    const parsed6 = parseExcelSixColumnClipboard(row);
    expect(parsed6.open).toHaveLength(1);
    expect(parsed6.product).toHaveLength(1);
    expect(parsed6.texture).toHaveLength(0);
    expect(parsed6.voice).toHaveLength(1);

    const parsed5 = parseExcelFiveColumnClipboard(row);
    expect(parsed5.open).toHaveLength(1);
    expect(parsed5.product).toHaveLength(1);
  });

  it("handles sparse rows with leading tabs and missing column 6 without adding extra voices", () => {
    const id = "1aBcDeFgHiJkLmNoPqRsTuVwXyZ12345";
    const link = `https://drive.google.com/file/d/${id}/view?usp=drive_link`;
    const rows = [
      `${link}\t${link}\t${link}\t${link}\t${link}\t${link}`,
      `${link}\t${link}\t${link}\t${link}\t${link}\t`,
      `\t\t${link}\t${link}\t${link}\t`,
    ].join("\n");

    const parsed = parseExcelSixColumnClipboard(rows);
    expect(parsed.open).toHaveLength(2);
    expect(parsed.product).toHaveLength(2);
    expect(parsed.texture).toHaveLength(3);
    expect(parsed.apply).toHaveLength(3);
    expect(parsed.end).toHaveLength(3);
    expect(parsed.voice).toHaveLength(1);
  });
});
