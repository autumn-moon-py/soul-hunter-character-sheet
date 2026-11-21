import { describe, expect, it } from "vitest";
import {
  abilityCharLimit,
  abilityTagLimit,
  gradeFromValue,
  hanLength,
  strengthFromValue,
} from "./grades";

describe("grades", () => {
  it("maps attribute values to grades", () => {
    expect(gradeFromValue(1)).toBe("E");
    expect(gradeFromValue(5)).toBe("A");
    expect(gradeFromValue(9)).toBe("SSS+");
    expect(gradeFromValue(0)).toBeNull();
    expect(gradeFromValue(10)).toBeNull();
  });

  it("derives strength by floor division", () => {
    expect(strengthFromValue(1)).toBe(0);
    expect(strengthFromValue(2)).toBe(1);
    expect(strengthFromValue(3)).toBe(1);
    expect(strengthFromValue(4)).toBe(2);
    expect(strengthFromValue(9)).toBe(4);
  });

  it("raises ability limits at soul 7", () => {
    expect(abilityTagLimit(6)).toBe(3);
    expect(abilityTagLimit(7)).toBe(4);
    expect(abilityCharLimit(6)).toBe(80);
    expect(abilityCharLimit(7)).toBe(100);
  });

  it("counts Han characters and ignores punctuation and symbols", () => {
    expect(hanLength("火焰")).toBe(2);
    expect(hanLength("火焰，燃烧！")).toBe(4);
    expect(hanLength("【伤害】+2")).toBe(2);
    expect(hanLength("🔥")).toBe(0);
  });
});
