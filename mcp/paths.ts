import { existsSync } from "node:fs";
import path from "node:path";

/** 向上查找同时包含 package.json 与 content/report.json 的项目根 */
export function findProjectRoot(start: string): string {
  let dir = path.resolve(start);
  for (let index = 0; index < 8; index += 1) {
    if (
      existsSync(path.join(dir, "package.json")) &&
      existsSync(path.join(dir, "content", "report.json"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(start);
}
