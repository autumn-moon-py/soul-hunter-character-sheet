#!/usr/bin/env python3
"""从狩魂者空白卡 xlsx 与规则书 markdown 抽取结构化内容。

输出到 content/*.json。脚本只负责抽取，不做业务判断；
冲突与缺失由 validate_content.py 统一报告。
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

import openpyxl

ROOT = Path(os.environ.get("SOUL_HUNTER_ROOT", "/Volumes/跑团/规则/狩魂者"))
XLSX = ROOT / "狩魂者卡" / "狩魂者空白卡正式版V2.0.1.xlsx"
RULES = ROOT / "规则书"
OUT = Path(__file__).resolve().parent.parent / "content"

# P1 只接入核心规则书；扩展内容保留在源表中，暂不进入产品。
CORE_ONLY = True

EXPANSIONS = [
    {"id": "edge-dweller", "name": "边缘人扮演指南"},
    {"id": "xiajie", "name": "侠界之旅联动"},
    {"id": "liuhang-spear", "name": "刘航的枪术大全"},
    {"id": "weichi-talisman", "name": "韦迟的符咒手册"},
    {"id": "disorder", "name": "失序症联动"},
    {"id": "midnight-bio", "name": "子夜生物改造"},
    {"id": "scare-box", "name": "惊吓盒子"},
]

ACTIVE_EXPANSIONS = [] if CORE_ONLY else EXPANSIONS

RULES_META = {
    "rulesVersion": "1.0.1",
    "attributes": [
        {"id": "body", "name": "体魄"},
        {"id": "mind", "name": "智慧"},
        {"id": "soul", "name": "心魂"},
    ],
    "skills": [
        {"id": "athletics", "name": "运动", "attribute": "body"},
        {"id": "operation", "name": "操作", "attribute": "mind"},
        {"id": "stealth", "name": "隐秘", "attribute": "mind"},
        {"id": "investigation", "name": "调查", "attribute": "mind"},
        {"id": "insight", "name": "洞察", "attribute": "soul"},
        {"id": "persuasion", "name": "说服", "attribute": "soul"},
        {"id": "hunter-lore", "name": "狩魂学识", "attribute": None},
    ],
    "grades": [
        {"grade": "E", "value": 1},
        {"grade": "D", "value": 2},
        {"grade": "C", "value": 3},
        {"grade": "B", "value": 4},
        {"grade": "A", "value": 5},
        {"grade": "S", "value": 6},
        {"grade": "SS", "value": 7},
        {"grade": "SSS", "value": 8},
        {"grade": "SSS+", "value": 9},
    ],
    "insightThresholds": [
        {"insight": 10, "unlock": "specialty", "label": "获得一项自选专长"},
        {"insight": 12, "unlock": "soulWeapon", "label": "获得灵魂武器"},
        {"insight": 14, "unlock": "ultimate1", "label": "习得一挡狩魂绝技"},
        {"insight": 16, "unlock": "specialty2", "label": "获得另一项自选专长"},
        {"insight": 18, "unlock": "ultimate2", "label": "习得二挡狩魂绝技"},
    ],
    "base": {
        "insight": 9,
        "attributeMin": 1,
        "attributeMaxAtCreation": 5,
        "attributeMax": 9,
        "hpBase": 5,
        "mpBase": 5,
        "defense": 10,
        "itemPoints": 3,
        "stylePoints": 10,
        "stylePointsMax": 100,
        "expMax": 10,
    },
    "growthCosts": {"insight": 6, "imprint": 4, "experienceTag": 4},
    "limits": {
        "abilityTags": 3,
        "abilityTagsHighSoul": 4,
        "abilityChars": 80,
        "abilityCharsHighSoul": 100,
        "experienceTags": 3,
        "soulWeaponImprints": "soulStrength",
        "specialties": 2,
        "ultimates": 2,
    },
    "expansions": ACTIVE_EXPANSIONS,
}


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    text = text.replace("\u3000", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return text.strip()


def flag(value: Any) -> bool:
    return clean(value) in {"☑", "√", "是", "True", "true", "1"}


def write_json(name: str, payload: Any) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(OUT.parent)}")


def section_for(row: int, ranges: list[tuple[int, int, str | None]]) -> str | None:
    for start, end, expansion in ranges:
        if start <= row <= end:
            return expansion
    return None


def parse_martial(wb: openpyxl.Workbook) -> list[dict[str, Any]]:
    ws = wb["武技"]
    ranges = [(4, 60, None), (62, 76, "liuhang-spear")]
    items: list[dict[str, Any]] = []
    for row in range(4, ws.max_row + 1):
        name = clean(ws[f"B{row}"].value)
        if not name or name.startswith("官方拓展"):
            continue
        expansion = section_for(row, ranges)
        if CORE_ONLY and expansion:
            continue
        items.append(
            {
                "id": f"martial.{name}",
                "kind": "martial",
                "name": name,
                "expansion": expansion,
                "category": None,
                "cost": clean(ws[f"C{row}"].value),
                "target": clean(ws[f"D{row}"].value),
                "support": flag(ws[f"E{row}"].value),
                "secret": flag(ws[f"F{row}"].value),
                "effect": clean(ws[f"G{row}"].value),
                "flavor": clean(ws[f"H{row}"].value),
                "source": {"sheet": "武技", "row": row},
            }
        )
    return items


def parse_spells(wb: openpyxl.Workbook) -> list[dict[str, Any]]:
    ws = wb["术法"]
    ranges = [(4, 133, None), (135, 150, "weichi-talisman"), (153, 166, "disorder")]
    items: list[dict[str, Any]] = []
    for row in range(4, ws.max_row + 1):
        name = clean(ws[f"B{row}"].value)
        if not name or name.startswith("官方拓展"):
            continue
        expansion = section_for(row, ranges)
        if CORE_ONLY and expansion:
            continue
        items.append(
            {
                "id": f"spell.{name}",
                "kind": "spell",
                "name": name,
                "expansion": expansion,
                "category": clean(ws[f"E{row}"].value),
                "type": clean(ws[f"G{row}"].value),
                "cost": clean(ws[f"C{row}"].value),
                "target": clean(ws[f"D{row}"].value),
                "secret": flag(ws[f"F{row}"].value),
                "effect": clean(ws[f"H{row}"].value),
                "flavor": clean(ws[f"I{row}"].value),
                "source": {"sheet": "术法", "row": row},
            }
        )
    return items


def parse_imprints(wb: openpyxl.Workbook) -> list[dict[str, Any]]:
    ws = wb["灵能印记"]
    items: list[dict[str, Any]] = []
    for row in range(4, 30):
        name = clean(ws[f"B{row}"].value)
        if not name:
            continue
        items.append(
            {
                "id": f"imprint.{name}",
                "kind": "imprint",
                "name": name,
                "expansion": None,
                "description": clean(ws[f"E{row}"].value),
                "source": {"sheet": "灵能印记", "row": row},
            }
        )
    return items


def parse_liberation_tags(wb: openpyxl.Workbook) -> list[dict[str, Any]]:
    if CORE_ONLY:
        return []
    ws = wb["灵能印记"]
    items: list[dict[str, Any]] = []
    for row in range(39, 57):
        name = clean(ws[f"B{row}"].value)
        if not name:
            continue
        items.append(
            {
                "id": f"liberationTag.{name}",
                "kind": "liberationTag",
                "name": name,
                "expansion": "midnight-bio",
                "description": clean(ws[f"E{row}"].value),
                "source": {"sheet": "灵能印记", "row": row},
            }
        )
    return items


def parse_specialties(wb: openpyxl.Workbook) -> list[dict[str, Any]]:
    ws = wb["专长"]
    items: list[dict[str, Any]] = []
    for row in range(4, 33):
        name = clean(ws[f"B{row}"].value)
        if not name:
            continue
        items.append(
            {
                "id": f"specialty.{name}",
                "kind": "specialty",
                "name": name,
                "expansion": None,
                "description": clean(ws[f"C{row}"].value),
                "source": {"sheet": "专长", "row": row},
            }
        )
    return items


ULTIMATE_NAME_CORRECTIONS = {
    # xlsx 与规则书不一致：规则书为「狩猎哨兵」
    "狞猎哨兵": "狩猎哨兵",
}


def parse_ultimates(wb: openpyxl.Workbook) -> list[dict[str, Any]]:
    ws = wb["绝技"]
    items: list[dict[str, Any]] = []
    tier = ""
    for row in range(4, 15):
        raw_name = clean(ws[f"B{row}"].value)
        if not raw_name:
            continue
        name = ULTIMATE_NAME_CORRECTIONS.get(raw_name, raw_name)
        if clean(ws[f"G{row}"].value):
            tier = clean(ws[f"G{row}"].value).replace("\n", "")
        item = {
            "id": f"ultimate.{name}",
            "kind": "ultimate",
            "name": name,
            "expansion": None,
            "tier": 2 if "二" in tier else 1,
            "soul": clean(ws[f"C{row}"].value),
            "domain": clean(ws[f"D{row}"].value),
            "description": clean(ws[f"E{row}"].value),
            "effect": clean(ws[f"F{row}"].value),
            "source": {"sheet": "绝技", "row": row},
        }
        if name != raw_name:
            item["originalName"] = raw_name
        items.append(item)
    return items


STYLE_SECTIONS = [
    (4, 30, None),
    (40, 57, "edge-dweller"),
    (58, 70, "xiajie"),
    (71, 83, "liuhang-spear"),
    (84, 96, "weichi-talisman"),
    (97, 111, "disorder"),
    (112, 123, "midnight-bio"),
]

COST_RE = re.compile(r"^(\d+)\s*(?:点)?\s*时髦值")


def split_action(text: str) -> tuple[str, str]:
    for sep in ("-", "－", "—"):
        if sep in text:
            name, effect = text.split(sep, 1)
            return name.strip(), effect.strip()
    return text.strip(), ""


def parse_styles(wb: openpyxl.Workbook) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    ws = wb["时髦动作"]
    actions: list[dict[str, Any]] = []
    styles: list[dict[str, Any]] = []
    current_style = ""
    for row in range(4, 124):
        b = clean(ws[f"B{row}"].value)
        c = clean(ws[f"C{row}"].value)
        d = clean(ws[f"D{row}"].value)

        if b.startswith("官方拓展") or b.startswith("如需") or b.startswith("自创时髦动作"):
            continue
        if b == "时髦风格" and c == "消耗":
            continue

        if b and b not in {"时髦风格"}:
            current_style = b

        expansion = section_for(row, STYLE_SECTIONS)
        if CORE_ONLY and expansion:
            continue
        if not c and not d:
            continue

        cost_match = COST_RE.match(c)
        if cost_match and d:
            name, effect = split_action(d)
            actions.append(
                {
                    "id": f"styleAction.{current_style}.{name}",
                    "kind": "styleAction",
                    "name": name,
                    "style": current_style,
                    "cost": int(cost_match.group(1)),
                    "effect": effect,
                    "expansion": expansion,
                    "source": {"sheet": "时髦动作", "row": row},
                }
            )
            continue

        if c and not cost_match and not d:
            styles.append(
                {
                    "id": f"style.{current_style}",
                    "kind": "style",
                    "name": current_style,
                    "expansion": expansion,
                    "description": c,
                    "source": {"sheet": "时髦动作", "row": row},
                }
            )

    # 以动作为准推导风格包；描述作为补充。
    descriptions = {s["name"]: s["description"] for s in styles}
    grouped: dict[tuple[str, str | None], list[dict[str, Any]]] = {}
    for action in actions:
        key = (action["style"], action["expansion"])
        grouped.setdefault(key, []).append(action)

    derived: list[dict[str, Any]] = []
    for (style_name, expansion), group in grouped.items():
        derived.append(
            {
                "id": f"style.{style_name}" + (f".{expansion}" if expansion else ""),
                "kind": "style",
                "name": style_name,
                "expansion": expansion,
                "description": descriptions.get(style_name, ""),
                "actionIds": [a["id"] for a in group],
                "costs": sorted({a["cost"] for a in group}),
            }
        )
    return actions, derived


def parse_bond_tags() -> dict[str, str]:
    """2.6 的羁绊—经历标签示例表，用于建卡时自动带入标签"""
    path = RULES / "02 第二章 成为狩魂者" / "2.6 提升你的狩魂者.md"
    text = path.read_text(encoding="utf-8")
    tags: dict[str, str] = {}
    in_table = False
    for line in text.splitlines():
        if line.startswith("| 羁绊 |"):
            in_table = True
            continue
        if not in_table:
            continue
        if not line.startswith("|"):
            break
        match = re.match(r"^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$", line)
        if not match:
            continue
        name, tag = match.groups()
        if set(name) <= set("-: "):
            continue
        tags[name] = tag
    return tags


def parse_bonds() -> list[dict[str, Any]]:
    path = RULES / "02 第二章 成为狩魂者" / "2.2 创建狩魂者羁绊.md"
    text = path.read_text(encoding="utf-8")
    bonus_tags = parse_bond_tags()
    items: list[dict[str, Any]] = []
    current = ""
    for line in text.splitlines():
        if line.startswith("## "):
            current = line[3:].strip()
            continue
        match = re.match(r"^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|$", line)
        if not match or not current:
            continue
        roll, name, description = match.groups()
        if name in {"羁绊", "---"}:
            continue
        items.append(
            {
                "id": f"bond.{current}.{name}",
                "kind": "bond",
                "category": current,
                "roll": int(roll),
                "name": name,
                "description": description.strip(),
                "experienceTag": bonus_tags.get(name, ""),
                "expansion": None,
            }
        )
    return items


def main() -> None:
    wb = openpyxl.load_workbook(XLSX, data_only=True)

    martial = parse_martial(wb)
    spells = parse_spells(wb)
    imprints = parse_imprints(wb)
    liberation_tags = parse_liberation_tags(wb)
    specialties = parse_specialties(wb)
    ultimates = parse_ultimates(wb)
    actions, styles = parse_styles(wb)
    bonds = parse_bonds()

    write_json("martial-arts.json", {"kind": "martial", "items": martial})
    write_json("spells.json", {"kind": "spell", "items": spells})
    write_json("imprints.json", {"kind": "imprint", "items": imprints})
    write_json("liberation-tags.json", {"kind": "liberationTag", "items": liberation_tags})
    write_json("specialties.json", {"kind": "specialty", "items": specialties})
    write_json("ultimates.json", {"kind": "ultimate", "items": ultimates})
    write_json("style-actions.json", {"kind": "styleAction", "items": actions, "styles": styles})
    write_json("bonds.json", {"kind": "bond", "items": bonds})
    write_json("expansions.json", {"items": ACTIVE_EXPANSIONS})
    write_json("rules-meta.json", RULES_META)

    print("\ncounts:")
    for label, items in (
        ("martial", martial),
        ("spell", spells),
        ("imprint", imprints),
        ("liberationTag", liberation_tags),
        ("specialty", specialties),
        ("ultimate", ultimates),
        ("styleAction", actions),
        ("style", styles),
        ("bond", bonds),
    ):
        print(f"  {label}: {len(items)}")


if __name__ == "__main__":
    main()
