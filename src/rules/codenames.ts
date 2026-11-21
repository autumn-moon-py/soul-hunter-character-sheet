/**
 * 规则书 2.3「使用随机表决定绰号」。
 * 先掷 1d4 选表，再掷 1d20 选字，重复 1～3 次后自由组合。
 */
export const CODENAME_TABLES: readonly (readonly string[])[] = [
  ["焰", "霆", "霜", "岚", "雫", "星", "月", "湘", "钢", "硫", "牙", "心", "骨", "血", "眼", "发", "影", "尘", "界", "隐"],
  ["鸢", "枭", "麏", "虫", "狸", "璇", "瑶", "玉", "璟", "翠", "缎", "绫", "绸", "绮", "锦", "菊", "芭", "葵", "荆", "松"],
  ["晨", "霞", "暮", "夜", "宵", "华", "虚", "幻", "梦", "醉", "墨", "琴", "歌", "音", "舞", "逸", "怒", "悲", "怨", "诛"],
  ["乱", "烈", "祸", "绝", "威", "狱", "墓", "壬", "嵬", "魂", "凌", "碎", "独", "断", "闪", "姬", "子", "侠", "客", "者"],
];

function pickIndex(size: number, random: () => number): number {
  return Math.min(size - 1, Math.max(0, Math.floor(random() * size)));
}

/** 掷一次：1d4 选表，1d20 选字 */
export function rollCodenameChar(random: () => number = Math.random): string {
  const table = CODENAME_TABLES[pickIndex(CODENAME_TABLES.length, random)];
  return table[pickIndex(table.length, random)];
}

/** 连续掷 1～3 次，得到可自由排序的绰号字 */
export function rollCodename(
  length = 2,
  random: () => number = Math.random,
): string {
  const count = Math.min(3, Math.max(1, Math.round(length)));
  return Array.from({ length: count }, () => rollCodenameChar(random)).join("");
}
