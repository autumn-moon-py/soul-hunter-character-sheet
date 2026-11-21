import { SKILLS } from "@/src/rules/constants";
import { derive } from "@/src/rules/derive";
import type { SoulHunterCharacter } from "@/src/types";

function displayName(character: SoulHunterCharacter): string {
  return character.identity.codename || character.identity.name || "狩魂者";
}

/** 按空白卡的骰娘录卡模板生成 .st 指令 */
export function buildDiceBotCommand(character: SoulHunterCharacter): string {
  const derived = derive(character);
  const parts = [
    displayName(character),
    `hp${character.resources.hpCurrent ?? derived.hpMax}`,
    `hpmax${derived.hpMax}`,
    `mp${character.resources.mpCurrent ?? derived.mpMax}`,
    `mpmax${derived.mpMax}`,
    `shm${character.resources.stylePoints ?? 0}`,
    "shmmax100",
    `exp${character.resources.exp ?? 0}`,
    `道具点${character.resources.itemPoints ?? 0}`,
    `体魄${character.attributes.body}`,
    `智慧${character.attributes.mind}`,
    `心魂${character.attributes.soul}`,
    ...SKILLS.map((skill) => `${skill.name}${derived.skills[skill.id]}`),
  ];
  return `.st ${parts.join("-")}`;
}

/** 按空白卡的回声岛录卡模板生成 .st 指令 */
export function buildEchoIslandCommand(character: SoulHunterCharacter): string {
  const derived = derive(character);
  return [
    ".st ",
    `hp${character.resources.hpCurrent ?? derived.hpMax}`,
    `mp${character.resources.mpCurrent ?? derived.mpMax}`,
    `时髦值${character.resources.stylePoints ?? 0}`,
    `exp${character.resources.exp ?? 0}`,
    `道具点${character.resources.itemPoints ?? 0}`,
    `体魄${character.attributes.body}`,
    `武技强度${derived.strengths.body}`,
    `智慧${character.attributes.mind}`,
    `术法强度${derived.strengths.mind}`,
    `心魂${character.attributes.soul}`,
    `灵能力强度${derived.strengths.soul}`,
    ...SKILLS.map((skill) => `${skill.name}${derived.skills[skill.id]}`),
  ].join("");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}
