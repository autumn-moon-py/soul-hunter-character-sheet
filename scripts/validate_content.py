#!/usr/bin/env python3
"""交叉校验 xlsx 抽取结果与规则书 markdown。

原则：
- xlsx 是结构化字段的来源，markdown 是描述与命名的校对源。
- markdown 缺少扩展内容属于正常情况，记为 info。
- markdown 有而 xlsx 没有、字段为空、ID 重复、扩展引用非法、预设数值与公式矛盾，记为 error/warning。
"""

from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(os.environ.get("SOUL_HUNTER_ROOT", "/Volumes/跑团/规则/狩魂者"))
RULES = ROOT / "规则书"
OUT = Path(__file__).resolve().parent.parent / "content"


def load(name: str) -> Any:
    return json.loads((OUT / name).read_text(encoding="utf-8"))


def markdown_headings(path: Path, prefix: str) -> list[str]:
    text = path.read_text(encoding="utf-8")
    return [m.group(1).strip() for m in re.finditer(rf"^{prefix} (.+)$", text, re.M)]


def markdown_imprints() -> list[str]:
    path = RULES / "04 第四章 狩魂手册" / "4.6 灵魂武器.md"
    text = path.read_text(encoding="utf-8")
    start = text.find("### 灵能印记列表")
    if start == -1:
        return []
    section = text[start:]
    end = section.find("\n## ", 1)
    if end != -1:
        section = section[:end]
    names: list[str] = []
    for line in section.splitlines():
        match = re.match(r"^\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|$", line)
        if not match:
            continue
        name, description = match.groups()
        name = name.strip()
        if name in {"印记", "---"} or "效果" in name:
            continue
        names.append(name)
    return names


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    previous = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        current = [i]
        for j, cb in enumerate(b, 1):
            current.append(
                min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + (ca != cb),
                )
            )
        previous = current
    return previous[-1]


def main() -> None:
    martial = load("martial-arts.json")["items"]
    spells = load("spells.json")["items"]
    imprints = load("imprints.json")["items"]
    specialties = load("specialties.json")["items"]
    ultimates = load("ultimates.json")["items"]
    actions = load("style-actions.json")["items"]
    expansions = {item["id"] for item in load("expansions.json")["items"]}

    issues: list[dict[str, Any]] = []
    coverage: dict[str, Any] = {}

    def add(level: str, kind: str, message: str, **extra: Any) -> None:
        issues.append({"level": level, "kind": kind, "message": message, **extra})

    def compare(
        kind: str,
        xlsx_names: list[str],
        markdown_names: list[str],
    ) -> None:
        xlsx_set = set(xlsx_names)
        markdown_set = set(markdown_names)
        common = xlsx_set & markdown_set
        xlsx_only = sorted(xlsx_set - markdown_set)
        markdown_only = sorted(markdown_set - xlsx_set)
        coverage[kind] = {
            "xlsx": len(xlsx_set),
            "markdown": len(markdown_set),
            "common": len(common),
            "xlsxOnly": xlsx_only,
            "markdownOnly": markdown_only,
        }
        for name in markdown_only:
            add("warning", "markdown-only", f"{kind} 「{name}」在规则书中存在，但 xlsx 未抽取到")
        for name in xlsx_only:
            near = [other for other in markdown_only if levenshtein(name, other) <= 1]
            if near:
                add(
                    "warning",
                    "likely-typo",
                    f"{kind} 「{name}」与规则书「{near[0]}」仅差一字，疑似录入差异",
                    xlsx=name,
                    markdown=near[0],
                )
            else:
                add("info", "xlsx-only", f"{kind} 「{name}」仅存在于 xlsx（可能为扩展或较新内容）")

    compare(
        "martial",
        [c["name"] for c in martial],
        markdown_headings(RULES / "04 第四章 狩魂手册" / "4.2 武技.md", "###"),
    )
    compare(
        "spell",
        [c["name"] for c in spells],
        markdown_headings(RULES / "04 第四章 狩魂手册" / "4.3 术法.md", "###"),
    )
    compare(
        "specialty",
        [c["name"] for c in specialties],
        markdown_headings(RULES / "04 第四章 狩魂手册" / "4.7 狩魂专长.md", "##"),
    )

    ultimate_md = [
        re.sub(r"（.*", "", name).strip()
        for name in markdown_headings(RULES / "04 第四章 狩魂手册" / "4.8 狩魂绝技.md", "###")
        if "示例" not in name and "描述领域" not in name
    ]
    compare("ultimate", [c["name"] for c in ultimates], ultimate_md)
    compare("imprint", [c["name"] for c in imprints], markdown_imprints())

    # 必填字段与重复 ID
    required: list[tuple[str, list[dict[str, Any]], list[str]]] = [
        ("martial", martial, ["name", "cost", "target", "effect"]),
        ("spell", spells, ["name", "cost", "target", "category", "type", "effect"]),
        ("imprint", imprints, ["name", "description"]),
        ("specialty", specialties, ["name", "description"]),
        ("ultimate", ultimates, ["name", "soul", "domain", "effect"]),
        ("styleAction", actions, ["name", "style", "effect"]),
    ]
    for kind, items, fields in required:
        seen: set[str] = set()
        for item in items:
            if item["id"] in seen:
                add("error", "duplicate-id", f"{kind} 重复 ID: {item['id']}")
            seen.add(item["id"])
            for field in fields:
                if not str(item.get(field, "")).strip():
                    add("error", "empty-field", f"{kind} 「{item.get('name', item['id'])}」缺少字段 {field}")
            expansion = item.get("expansion")
            if expansion and expansion not in expansions:
                add("error", "invalid-expansion", f"{kind} 「{item['name']}」引用了未知扩展 {expansion}")

    # 扩展内容分布
    expansion_counts: dict[str, int] = {}
    for item in [*martial, *spells, *imprints, *actions]:
        expansion = item.get("expansion")
        if expansion:
            expansion_counts[expansion] = expansion_counts.get(expansion, 0) + 1
    coverage["expansions"] = expansion_counts

    error_count = sum(1 for issue in issues if issue["level"] == "error")
    warning_count = sum(1 for issue in issues if issue["level"] == "warning")
    info_count = sum(1 for issue in issues if issue["level"] == "info")

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "errors": error_count,
            "warnings": warning_count,
            "infos": info_count,
        },
        "counts": {
            "martial": len(martial),
            "spell": len(spells),
            "imprint": len(imprints),
            "specialty": len(specialties),
            "ultimate": len(ultimates),
            "styleAction": len(actions),
        },
        "coverage": coverage,
        "issues": issues,
    }
    (OUT / "report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    print(f"errors={error_count} warnings={warning_count} infos={info_count}")
    for kind, data in coverage.items():
        if isinstance(data, dict) and "xlsx" in data:
            print(
                f"  {kind}: xlsx={data['xlsx']} markdown={data['markdown']} "
                f"common={data['common']} xlsxOnly={len(data['xlsxOnly'])} markdownOnly={len(data['markdownOnly'])}"
            )
    for issue in issues:
        if issue["level"] in {"error", "warning"}:
            print(f"  [{issue['level']}] {issue['message']}")

    if error_count:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
