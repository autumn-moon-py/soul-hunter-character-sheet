import { describe, expect, it } from "vitest";
import { catalog } from "../content";
import reportJson from "../../content/report.json";

describe("content catalog", () => {
  it("contains the expected number of entries", () => {
    expect(catalog.martialArts).toHaveLength(56);
    expect(catalog.spells).toHaveLength(129);
    expect(catalog.imprints).toHaveLength(26);
    expect(catalog.specialties).toHaveLength(29);
    expect(catalog.ultimates).toHaveLength(10);
    expect(catalog.styleActions).toHaveLength(26);
    expect(catalog.styles).toHaveLength(6);
    expect(catalog.bonds).toHaveLength(48);
    expect(catalog.expansions).toHaveLength(0);
  });

  it("has unique ids across all card kinds", () => {
    const total =
      catalog.martialArts.length +
      catalog.spells.length +
      catalog.imprints.length +
      catalog.specialties.length +
      catalog.ultimates.length +
      catalog.styleActions.length +
      catalog.bonds.length;
    expect(catalog.byId.size).toBe(total);
  });

  it("keeps style packs complete", () => {
    for (const style of catalog.styles) {
      expect(style.actionIds.length).toBeGreaterThan(0);
      for (const actionId of style.actionIds) {
        expect(catalog.byId.get(actionId)?.kind).toBe("styleAction");
      }
      if (style.name !== "通用") {
        expect(style.actionIds).toHaveLength(5);
      }
    }
  });

  it("has required fields on every spell", () => {
    for (const spell of catalog.spells) {
      expect(spell.name).not.toBe("");
      expect(spell.category).not.toBe("");
      expect(spell.type).not.toBe("");
      expect(spell.effect).not.toBe("");
    }
  });

  it("has no errors in the cross-validation report", () => {
    expect(reportJson.summary.errors).toBe(0);
  });

  it("uses the corrected 狩猎哨兵 name", () => {
    expect(catalog.byId.get("ultimate.狩猎哨兵")).toBeDefined();
    expect(catalog.byId.get("ultimate.狞猎哨兵")).toBeUndefined();
  });
});
