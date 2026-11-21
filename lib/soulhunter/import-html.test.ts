import { describe, expect, it } from "vitest";
import { createLegalCharacter } from "@/src/rules/fixtures";
import { buildCharacterHtml } from "./export-html";
import {
  extractCharacterPayload,
  normalizeImportedCharacter,
} from "./import-html";

describe("character HTML round trip", () => {
  it("embeds a payload that restores the character as a new save", () => {
    const source = createLegalCharacter();
    source.identity.avatar = "data:image/png;base64,AAAA";
    source.resources.exp = 3;

    const html = buildCharacterHtml(source);
    const payload = extractCharacterPayload(html);
    const imported = normalizeImportedCharacter(payload);

    expect(payload).not.toBeNull();
    expect(imported).not.toBeNull();
    expect(imported?.id).not.toBe(source.id);
    expect(imported?.identity.name).toBe("吴焰");
    expect(imported?.identity.codename).toBe("血焰子");
    expect(imported?.identity.avatar).toBe("data:image/png;base64,AAAA");
    expect(imported?.attributes).toEqual(source.attributes);
    expect(imported?.selections.spellIds).toEqual(source.selections.spellIds);
    expect(imported?.style.actionIds).toEqual(source.style.actionIds);
    expect(imported?.resources.exp).toBe(3);
  });

  it("does not let card text close the data script early", () => {
    const source = createLegalCharacter();
    source.identity.name = "</script><script>alert(1)</script>";

    const payload = extractCharacterPayload(buildCharacterHtml(source));
    const imported = normalizeImportedCharacter(payload);

    expect(imported?.identity.name).toBe("</script><script>alert(1)</script>");
  });

  it("rejects html without a payload and unsupported versions", () => {
    expect(extractCharacterPayload("<html><body>没有数据</body></html>")).toBeNull();
    expect(normalizeImportedCharacter({ schemaVersion: 2 })).toBeNull();
    expect(normalizeImportedCharacter("not a character")).toBeNull();
  });
});
