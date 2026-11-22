import type { AttributeId, Grade } from "../types";
import { GRADE_BY_VALUE, SECRET_GRADE_VALUE } from "./constants";

export function gradeFromValue(value: number): Grade | null {
  return GRADE_BY_VALUE[value] ?? null;
}

export function strengthFromValue(value: number): number {
  return Math.floor(value / 2);
}

export function isSecretAllowed(attribute: AttributeId, value: number): boolean {
  if (attribute === "body" || attribute === "mind") {
    return value >= SECRET_GRADE_VALUE;
  }
  return false;
}

export function abilityTagLimit(soul: number): number {
  return soul >= 7 ? 4 : 3;
}

export function abilityCharLimit(soul: number): number {
  return soul >= 7 ? 100 : 80;
}

/** 统计汉字字数，标点与符号不计入 */
export function hanLength(text: string): number {
  return text.match(/\p{Script=Han}/gu)?.length ?? 0;
}

/** 灵能力标签写在描述里，用「」标示；【】是效果名，不算标签 */
export function extractAbilityTags(text: string): string[] {
  const tags: string[] = [];
  const pattern = /「([^」]*)」/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const tag = match[1].trim();
    if (tag) tags.push(tag);
  }
  return tags;
}
