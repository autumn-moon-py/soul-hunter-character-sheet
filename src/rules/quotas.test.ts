import { describe, expect, it } from "vitest";
import { catalog } from "../content";
import {
  imprintQuota,
  martialQuota,
  spellQuota,
  specialtyQuota,
  styleActionQuota,
  ultimateQuota,
} from "./quotas";

describe("quotas", () => {
  it("computes martial arts quota by body grade", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(martialQuota)).toEqual([
      0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ]);
  });

  it("computes spell quota by mind grade", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(spellQuota)).toEqual([
      0, 2, 4, 4, 6, 6, 8, 8, 10,
    ]);
  });

  it("computes specialty and ultimate quotas by insight", () => {
    expect([9, 10, 12, 14, 15, 16, 18].map(specialtyQuota)).toEqual([0, 1, 1, 1, 1, 2, 2]);
    expect([9, 10, 13, 14, 17, 18].map(ultimateQuota)).toEqual([0, 0, 0, 1, 1, 2]);
  });

  it("caps imprints by 1/2/4 at the three growth stages", () => {
    expect(imprintQuota(9, 2)).toBe(0);
    expect(imprintQuota(9, 3)).toBe(1);
    expect(imprintQuota(12, 1)).toBe(0);
    expect(imprintQuota(12, 2)).toBe(1);
    expect(imprintQuota(9, 4)).toBe(1);
    expect(imprintQuota(9, 5)).toBe(2);
    expect(imprintQuota(16, 7)).toBe(2);
    expect(imprintQuota(18, 9)).toBe(4);
  });

  it("counts style actions with universal actions", () => {
    expect(
      styleActionQuota(catalog, { mode: "preset", styleId: "style.策定山河", actionIds: [] }, []),
    ).toBe(6);
    expect(
      styleActionQuota(catalog, { mode: "preset", styleId: "style.通用", actionIds: [] }, []),
    ).toBe(1);
    expect(styleActionQuota(catalog, { mode: "preset", actionIds: [] }, [])).toBe(1);
    expect(styleActionQuota(catalog, { mode: "combined", actionIds: [] }, [])).toBe(6);
  });
});
