import { describe, expect, it } from "vitest";
import { CODENAME_TABLES, rollCodename, rollCodenameChar } from "./codenames";

describe("codename random tables", () => {
  it("keeps the four official d20 tables", () => {
    expect(CODENAME_TABLES).toHaveLength(4);
    for (const table of CODENAME_TABLES) {
      expect(table).toHaveLength(20);
    }
  });

  it("rolls a character from the selected table", () => {
    const values = [0, 0, 0.99, 0.99];
    let cursor = 0;
    const random = () => values[cursor++];

    expect(rollCodenameChar(random)).toBe("焰");
    expect(rollCodenameChar(random)).toBe("者");
  });

  it("clamps the generated codename to 1-3 characters", () => {
    expect(Array.from(rollCodename(0, () => 0))).toHaveLength(1);
    expect(Array.from(rollCodename(2, () => 0))).toHaveLength(2);
    expect(Array.from(rollCodename(9, () => 0))).toHaveLength(3);
  });
});
