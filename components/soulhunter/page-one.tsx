"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { catalog } from "@/src/content";
import {
  ABILITY_SPECIALTIES,
  BASE,
  SKILLS,
  SOUL_WEAPON_FORM_GROUPS,
} from "@/src/rules/constants";
import { derive } from "@/src/rules/derive";
import { hanLength } from "@/src/rules/grades";
import type { AttributeId, SkillId } from "@/src/types";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { cn } from "@/lib/utils";
import { CardSection } from "./card-section";
import { ExperienceBlock } from "./experience-block";
import { PocketsBlock } from "./pockets-block";
import { Block, Line, Paper, PaperStepper } from "./paper-kit";

const ATTRIBUTE_LABEL: Record<AttributeId, string> = {
  body: "体魄",
  mind: "智慧",
  soul: "心魂",
};

/** 对应纸卡上的涂色环，用 4 段圆点表示强度 */
function StrengthDots({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4].map((step) => (
        <span
          key={step}
          className={cn(
            "h-2 w-2 rounded-full border border-ink",
            step <= value ? "bg-ink" : "bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

/** 纸面数字输入：失焦或回车时提交并夹取范围；blankAtZero 用于「未分配」状态 */
function EditableNumber({
  value,
  min,
  max,
  ariaLabel,
  onCommit,
  blankAtZero = false,
  live = false,
}: {
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  onCommit: (value: number) => void;
  blankAtZero?: boolean;
  live?: boolean;
}) {
  const display = blankAtZero && value === 0 ? "" : String(value);
  const [draft, setDraft] = useState(display);

  useEffect(() => {
    setDraft(display);
  }, [display]);

  const commit = () => {
    if (!draft.trim()) {
      if (blankAtZero) {
        onCommit(0);
        setDraft("");
      } else {
        setDraft(display);
      }
      return;
    }
    const parsed = Number.parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(display);
      return;
    }
    const next = Math.max(min, Math.min(max, parsed));
    onCommit(next);
    setDraft(blankAtZero && next === 0 ? "" : String(next));
  };

  return (
    <Input
      inputMode="numeric"
      aria-label={ariaLabel}
      placeholder={blankAtZero ? "—" : undefined}
      className="pc-attr-input mx-auto"
      value={draft}
      onChange={(event) => {
        const next = event.target.value.replace(/\D/g, "");
        setDraft(next);
        if (!live) return;
        const parsed = Number.parseInt(next, 10);
        if (Number.isNaN(parsed)) {
          if (blankAtZero) onCommit(0);
          return;
        }
        onCommit(Math.max(min, Math.min(max, parsed)));
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function AttributeInput({ attribute }: { attribute: AttributeId }) {
  const character = useCharacterStore((state) => state.character);
  const setAttribute = useCharacterStore((state) => state.setAttribute);

  return (
    <EditableNumber
      value={character.attributes[attribute]}
      min={0}
      max={9}
      blankAtZero
      live
      ariaLabel={`${ATTRIBUTE_LABEL[attribute]}数值`}
      onCommit={(value) => setAttribute(attribute, value)}
    />
  );
}

function InfoBlock() {
  const character = useCharacterStore((state) => state.character);
  const setIdentityField = useCharacterStore((state) => state.setIdentityField);
  const setBond = useCharacterStore((state) => state.setBond);
  const backgroundRef = useRef<HTMLTextAreaElement>(null);

  // 背景故事默认 3 行，随内容自动撑高
  useLayoutEffect(() => {
    const element = backgroundRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [character.identity.background]);

  const categories = Array.from(new Set(catalog.bonds.map((bond) => bond.category)));
  const bondOptions = catalog.bonds.filter((bond) => bond.category === character.bond?.category);
  // 选中具体关系后，把该羁绊的说明作为背景故事的灰色提示
  const backgroundPlaceholder = character.bond?.description
    ? `${character.bond.category}·${character.bond.name}：${character.bond.description}`
    : "写下你的来历、性格，或成为狩魂者的理由……";

  return (
    <Block title="角色信息" flush>
      <div className="grid grid-cols-2">
        <Line label="姓名" labelWidth={56} className="border-r border-paper-line">
          <Input
            className="text-center"
            value={character.identity.name}
            onChange={(event) => setIdentityField("name", event.target.value)}
          />
        </Line>
        <Line label="代号" labelWidth={56}>
          <Input
            className="text-center"
            value={character.identity.codename}
            onChange={(event) => setIdentityField("codename", event.target.value)}
          />
        </Line>
      </div>
      <div className="grid grid-cols-2">
        <Line label="性别" labelWidth={56} className="border-r border-paper-line">
          <Input
            className="text-center"
            value={character.identity.gender ?? ""}
            onChange={(event) => setIdentityField("gender", event.target.value)}
          />
        </Line>
        <Line label="年龄" labelWidth={56}>
          <Input
            className="text-center"
            value={character.identity.age ?? ""}
            onChange={(event) => setIdentityField("age", event.target.value)}
          />
        </Line>
      </div>
      <div className="grid grid-cols-2">
        <Line label="羁绊" labelWidth={56} className="border-r border-paper-line">
          <Select
            value={character.bond?.category ?? ""}
            onValueChange={(value) => setBond(value === "none" ? "" : value, "")}
          >
            <SelectTrigger className="h-[22px] text-pc-sm [&>span]:flex-1 [&>span]:text-center">
              <SelectValue placeholder="未选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未选</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Line>
        <Line label="关系" labelWidth={56}>
          <Select
            value={character.bond?.name ?? ""}
            onValueChange={(value) =>
              setBond(character.bond?.category ?? "", value === "none" ? "" : value)
            }
            disabled={!character.bond?.category}
          >
            <SelectTrigger className="h-[22px] text-pc-sm [&>span]:flex-1 [&>span]:text-center">
              <SelectValue placeholder="未选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">未选</SelectItem>
              {bondOptions.map((bond) => (
                <SelectItem key={bond.id} value={bond.name}>
                  {bond.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Line>
      </div>
      <div>
        <div className="flex h-6 items-center justify-center border-b border-paper-line bg-paper-tint px-2 text-pc-xs font-medium text-ink-soft">
          背景故事
        </div>
        <Textarea
          ref={backgroundRef}
          value={character.identity.background ?? ""}
          rows={3}
          aria-label="背景故事"
          placeholder={backgroundPlaceholder}
          className="resize-none overflow-hidden"
          style={{ padding: "4px 8px" }}
          onChange={(event) => setIdentityField("background", event.target.value)}
        />
      </div>
    </Block>
  );
}

function SkillsBlock() {
  const character = useCharacterStore((state) => state.character);
  const setSkillAllocation = useCharacterStore((state) => state.setSkillAllocation);
  const derived = useMemo(() => derive(character), [character]);

  return (
    <Block
      title="技能"
      meta={`总共 ${derived.skillPointsTotal} · 剩余 ${derived.skillPointsRemaining}`}
    >
      <table className="pc-table">
        <colgroup>
          <col style={{ width: "22%" }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "34%" }} />
          <col style={{ width: "22%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>技能</th>
            <th>属性强度</th>
            <th>自由分配</th>
            <th>技能强度</th>
          </tr>
        </thead>
        <tbody>
          {SKILLS.map((skill) => (
            <tr key={skill.id}>
              <td className="text-center text-pc-sm">{skill.name}</td>
              <td className="pc-skill-value text-center text-ink-muted tabular-nums">{derived.skillBase[skill.id as SkillId]}</td>
              <td>
                <span className="flex justify-center">
                  <PaperStepper
                    value={character.skills[skill.id] ?? 0}
                    min={0}
                    max={10}
                    onChange={(value) => setSkillAllocation(skill.id, value)}
                  />
                </span>
              </td>
              <td className="pc-skill-value text-center font-semibold tabular-nums">
                {derived.skills[skill.id as SkillId]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Block>
  );
}

function AttributesBlock() {
  const character = useCharacterStore((state) => state.character);
  const setInsight = useCharacterStore((state) => state.setInsight);
  const derived = useMemo(() => derive(character), [character]);
  const resourceClass = "w-full text-center text-pc-lg tabular-nums";
  const bigClass = "w-full text-center text-pc-xl font-semibold tabular-nums";

  return (
    <Block title="基础属性">
      <div className="grid grid-cols-3 gap-1">
        {(Object.keys(ATTRIBUTE_LABEL) as AttributeId[]).map((attribute) => (
          <div key={attribute} className="rounded border border-paper-line px-1 py-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-pc-xs font-semibold">{ATTRIBUTE_LABEL[attribute]}</span>
              <span className="rounded border border-paper-line bg-paper-tint px-1 py-px text-pc-xs font-semibold leading-none text-ink-soft">
                {derived.grades[attribute]}
              </span>
            </div>
            <div className="mt-0.5">
              <AttributeInput attribute={attribute} />
            </div>
            <div className="mt-0.5 flex justify-center">
              <StrengthDots value={derived.strengths[attribute]} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-2">
        <Line label="生命" labelWidth={44} className="border-r border-paper-line">
          <span className={resourceClass}>{derived.hpMax}</span>
        </Line>
        <Line label="灵力" labelWidth={44}>
          <span className={resourceClass}>{derived.mpMax}</span>
        </Line>
        <Line label="灵识" labelWidth={44} className="border-r border-paper-line">
          <EditableNumber
            value={character.insight}
            min={BASE.insight}
            max={27}
            ariaLabel="灵识数值"
            onCommit={setInsight}
          />
        </Line>
        <Line label="防御" labelWidth={44}>
          <span className={bigClass}>{derived.defense}</span>
        </Line>
        <Line label="时髦" labelWidth={44} className="border-r border-paper-line">
          <span className={resourceClass}>{character.resources.stylePoints ?? 0}</span>
        </Line>
        <Line label="道具" labelWidth={44}>
          <span className={resourceClass}>{character.resources.itemPoints ?? 0}</span>
        </Line>
      </div>
    </Block>
  );
}

function SpecialtySelect({
  value,
  onChange,
  disabled = false,
  placeholder = "选择专精",
}: {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Select
      value={value ?? ""}
      onValueChange={(next) => onChange(next === "none" ? "" : next)}
      disabled={disabled}
    >
      <SelectTrigger className="h-[22px] text-pc-sm [&>span]:flex-1 [&>span]:text-center">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none" className="text-ink-hint">
          不选择
        </SelectItem>
        {ABILITY_SPECIALTIES.map((item) => (
          <SelectItem key={item.name} value={item.name}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AbilityBlock() {
  const character = useCharacterStore((state) => state.character);
  const setAbilityField = useCharacterStore((state) => state.setAbilityField);
  const derived = useMemo(() => derive(character), [character]);
  const length = hanLength(character.ability.description);
  const secondSpecialtyUnlocked = character.attributes.soul >= 9;
  const specialties = [character.ability.specialization, character.ability.specialization2]
    .filter((name): name is string => Boolean(name))
    .flatMap((name) => ABILITY_SPECIALTIES.filter((item) => item.name === name));

  return (
    <Block
      title="灵能力"
      meta={`强度 ${derived.strengths.soul} · ${length}/${derived.quotas.abilityChars} 字`}
      flush
    >
      <div className="grid grid-cols-1 sm:grid-cols-3">
        <Line label="名称" labelWidth={44} className="sm:border-r border-paper-line">
          <Input
            className="text-center"
            value={character.ability.name}
            onChange={(event) => setAbilityField("name", event.target.value)}
          />
        </Line>
        <Line label="专精1" labelWidth={44} className="sm:border-r border-paper-line">
          <SpecialtySelect
            value={character.ability.specialization}
            onChange={(value) => setAbilityField("specialization", value)}
          />
        </Line>
        <Line label="专精2" labelWidth={44}>
          <SpecialtySelect
            value={character.ability.specialization2}
            onChange={(value) => setAbilityField("specialization2", value)}
            disabled={!secondSpecialtyUnlocked}
            placeholder={secondSpecialtyUnlocked ? "选择专精" : "心魂 SSS+"}
          />
        </Line>
      </div>
      <div className="space-y-0.5 border-t border-paper-line px-2 py-1 text-pc-sm leading-snug">
        {specialties.length > 0 ? (
          <>
            {specialties.map((item) => (
              <p key={item.name}>
                <span className="font-semibold text-ink-soft">{item.name}</span>
                <span className="text-ink-soft">：{item.description}</span>
              </p>
            ))}
            <p className="text-ink-hint">
              施展灵能力时选用上述效果，攻击检定成功额外获得 1 个【成功等级】。
            </p>
          </>
        ) : (
          <p className="text-ink-hint">选择专精后显示对应的通用效果。</p>
        )}
      </div>
      <div>
        <div className="flex h-6 items-center justify-center border-b border-paper-line bg-paper-tint text-pc-xs font-medium text-ink-soft">
          能力描述
        </div>
        <Textarea
          value={character.ability.description}
          rows={5}
          aria-label="灵能力描述"
          placeholder="描述这个灵能力的效果、限制或代价……"
          style={{ padding: "4px 8px" }}
          onChange={(event) => setAbilityField("description", event.target.value)}
        />
      </div>
    </Block>
  );
}

function WeaponBlock() {
  const character = useCharacterStore((state) => state.character);
  const setSoulWeaponField = useCharacterStore((state) => state.setSoulWeaponField);
  const unlocked = character.insight >= 12 || character.attributes.soul >= 3;
  const form = character.soulWeapon?.form ?? "";
  const appearance = character.soulWeapon?.appearance ?? "";
  const appearanceRef = useRef<HTMLTextAreaElement>(null);

  // 外形默认一行，按内容自动撑高
  useLayoutEffect(() => {
    const element = appearanceRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [appearance]);

  return (
    <Block title="灵魂武器" meta={unlocked ? undefined : "未解锁"} flush>
      <div className="grid grid-cols-2">
        <Line label="名称" labelWidth={44} className="border-r border-paper-line">
          <Input
            className="text-center"
            value={character.soulWeapon?.name ?? ""}
            disabled={!unlocked}
            onChange={(event) => setSoulWeaponField("name", event.target.value)}
          />
        </Line>
        <Line label="形态" labelWidth={44}>
          <div className="flex w-full items-center gap-1">
            <Input
              value={form}
              disabled={!unlocked}
              placeholder="选择或输入形态"
              aria-label="灵魂武器形态"
              className="min-w-0 flex-1"
              onChange={(event) => setSoulWeaponField("form", event.target.value)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="选择预设武器形态"
                  disabled={!unlocked}
                  className="flex h-5 w-4 shrink-0 items-center justify-center text-ink-hint transition-colors hover:text-ink disabled:opacity-50"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-64 w-40 overflow-y-auto">
                {SOUL_WEAPON_FORM_GROUPS.map((group) => (
                  <Fragment key={group.category}>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      {group.category}
                    </DropdownMenuLabel>
                    {group.forms.map((item) => (
                      <DropdownMenuItem
                        key={item}
                        className="text-xs"
                        onSelect={() => setSoulWeaponField("form", item)}
                      >
                        {item}
                      </DropdownMenuItem>
                    ))}
                  </Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Line>
      </div>
      <Line label="外形" labelWidth={44} className="is-auto mb-1.5">
        <Textarea
          ref={appearanceRef}
          value={appearance}
          disabled={!unlocked}
          rows={1}
          aria-label="灵魂武器外形"
          className="mb-[1px] resize-none overflow-hidden"
          style={{ minHeight: 22 }}
          onChange={(event) => setSoulWeaponField("appearance", event.target.value)}
        />
      </Line>
      <div className="mt-1">
        <CardSection kind="imprint" embedded />
      </div>
    </Block>
  );
}

export function PageOne() {
  return (
    <Paper>
      <div className="sheet-grid">
        <div className="sheet-col-left space-y-3">
          <InfoBlock />
          <ExperienceBlock />
          <AttributesBlock />
          <SkillsBlock />
        </div>

        <div className="sheet-col-middle space-y-3">
          <AbilityBlock />
          <WeaponBlock />
          <CardSection kind="specialty" />
          <PocketsBlock />
        </div>

        <div className="sheet-col-right space-y-3">
          <CardSection kind="spell" />
          <CardSection kind="martial" />
        </div>
      </div>
    </Paper>
  );
}
