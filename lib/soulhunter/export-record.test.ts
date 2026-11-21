import { describe, expect, it } from "vitest";
import { createLegalCharacter } from "@/src/rules/fixtures";
import { buildDiceBotCommand } from "./export-record";

describe("骰娘录卡指令", () => {
  it("按空白卡模板只在姓名后保留一个连字符", () => {
    const command = buildDiceBotCommand(createLegalCharacter());

    expect(command.startsWith(".st 【血焰子】吴焰-")).toBe(true);
    expect(command.match(/-/g)).toHaveLength(1);
    expect(command).toContain("hpmax");
    expect(command).toContain("shmmax100");
    expect(command).toContain("道具点3");
    expect(command).toContain("运动");
    expect(command).toContain("狩魂学识");
  });

  it("没有代号时只输出姓名", () => {
    const character = createLegalCharacter();
    character.identity.codename = "";

    expect(buildDiceBotCommand(character).startsWith(".st 吴焰-")).toBe(true);
  });
});
