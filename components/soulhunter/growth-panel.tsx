"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { catalog } from "@/src/content";
import { BASE, GROWTH_COSTS } from "@/src/rules/constants";
import {
  canCreateImprint,
  canIncreaseInsight,
  tryCreateExperienceTag,
  tryCreateImprint,
  tryIncreaseInsight,
  tryReplaceExperienceTag,
} from "@/src/rules/growth";
import type { AttributeId, SoulHunterCharacter } from "@/src/types";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { cn } from "@/lib/utils";
import { Block, PaperStepper } from "./paper-kit";

const ATTRIBUTE_LABEL: Record<AttributeId, string> = {
  body: "体魄",
  mind: "智慧",
  soul: "心魂",
};

/** Radix Select 不允许空字符串作为选项值，用哨兵值表示「清除选择」 */
const CLEAR_VALUE = "__clear__";

/** 规则书 2.6 的六条总结问题 */
const SUMMARY_QUESTIONS = [
  "完成了这次狩魂事件",
  "顺利完成了其中一个章节",
  "确保了群众的安全",
  "得到了刻骨铭心的教训",
  "挽救或救赎了一个灵魂",
  "参与了最令人印象深刻的场面",
];

function summaryExp(yes: number): number {
  if (yes <= 0) return 0;
  if (yes <= 2) return 1;
  if (yes <= 4) return 2;
  return 3;
}

function limitExp(character: SoulHunterCharacter, gain: number): SoulHunterCharacter {
  return {
    ...character,
    resources: {
      ...character.resources,
      exp: Math.min(BASE.expMax, (character.resources.exp ?? 0) + gain),
    },
  };
}

function MicroButton({
  children,
  disabled,
  onClick,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded border border-paper-line px-2 py-0.5 text-pc-xs text-ink-soft transition-colors hover:bg-paper-hover disabled:opacity-40",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 border-b border-paper-line-faint pb-0.5 text-pc-xs font-semibold tracking-wide text-ink-muted">
      {children}
    </div>
  );
}

function UpgradeCard({
  title,
  cost,
  description,
  children,
  action,
}: {
  title: string;
  cost: number;
  description: string;
  children: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded border border-paper-line bg-white/60 p-1.5">
      <div className="flex items-start justify-between gap-1">
        <span className="text-pc-xs font-semibold">{title}</span>
        <span className="shrink-0 rounded border border-paper-line bg-paper-tint px-1 text-pc-xs text-ink-soft">
          {cost} 经验
        </span>
      </div>
      <p className="mt-0.5 text-pc-xs leading-snug text-ink-hint">{description}</p>
      <div className="mt-1 flex flex-1 flex-col gap-1">{children}</div>
      <div className="mt-1.5">{action}</div>
    </div>
  );
}

export function GrowthPanel() {
  const character = useCharacterStore((state) => state.character);
  const setCharacter = useCharacterStore((state) => state.setCharacter);
  const setResource = useCharacterStore((state) => state.setResource);

  const [defects, setDefects] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>(() => SUMMARY_QUESTIONS.map(() => false));
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string>();

  const [insightAttribute, setInsightAttribute] = useState<AttributeId | "">("");
  const [imprintId, setImprintId] = useState("");
  const [tag, setTag] = useState("");
  const [replacedTag, setReplacedTag] = useState("");

  const exp = character.resources.exp ?? 0;
  const yesCount = answers.filter(Boolean).length;
  const pendingExp = defects + summaryExp(yesCount);

  const imprintOptions = useMemo(
    () =>
      catalog.imprints.filter(
        (card) =>
          (!card.expansion || character.expansions.includes(card.expansion)) &&
          !character.selections.imprintIds.includes(card.id),
      ),
    [character.expansions, character.selections.imprintIds],
  );
  const selectedImprintCard = imprintId ? catalog.byId.get(imprintId) : undefined;
  const selectedImprint =
    selectedImprintCard?.kind === "imprint" ? selectedImprintCard : undefined;

  const apply = (result: { ok: boolean; character: SoulHunterCharacter; error?: string }) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setCharacter(result.character);
  };

  const gainExperience = () => {
    if (pendingExp <= 0) return;
    setCharacter(limitExp(character, pendingExp));
    setDefects(0);
    setAnswers(SUMMARY_QUESTIONS.map(() => false));
  };

  const replacing = character.experienceTags.length >= 3;

  return (
    <Block title="升级">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-paper-line-faint pb-1.5">
        <div className="min-w-[160px] max-w-[340px] flex-1">
          <div className="flex items-baseline justify-between text-pc-xs text-ink-muted">
            <span>经验</span>
            <span className="tabular-nums">
              {exp} / {BASE.expMax}
            </span>
          </div>
          <div className="mt-1 flex gap-0.5">
            {Array.from({ length: BASE.expMax }).map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-sm border border-paper-line",
                  index < exp ? "bg-ink" : "bg-paper-tint",
                )}
              />
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 text-pc-xs">
          <span className="text-ink-muted">本次 +{pendingExp}</span>
          <MicroButton disabled={pendingExp <= 0} onClick={gainExperience}>
            应用
          </MicroButton>
        </div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,0.9fr)_minmax(0,2.1fr)]">
        <div className="rounded border border-paper-line bg-white/60 p-1.5">
          <ColumnTitle>获得经验</ColumnTitle>

          <div className="flex items-center justify-between py-0.5">
            <span className="text-pc-sm">激活缺陷</span>
            <PaperStepper value={defects} min={0} max={10} onChange={setDefects} />
          </div>

          <div className="border-t border-dashed border-paper-line-faint py-0.5">
            <button
              type="button"
              className="flex w-full items-center justify-between py-0.5"
              onClick={() => setExpanded((value) => !value)}
            >
              <span className="text-pc-sm">总结事件</span>
              <span className="flex items-center gap-1">
                <span className="rounded border border-paper-line bg-paper-tint px-1 text-pc-xs tabular-nums leading-4 text-ink-soft">
                  {yesCount} / 6
                </span>
                <span className="text-pc-xs tabular-nums text-ink-muted">
                  +{summaryExp(yesCount)}
                </span>
                <ChevronDown
                  className={cn("h-3 w-3 text-ink-hint transition-transform", expanded && "rotate-180")}
                />
              </span>
            </button>
            {expanded ? (
              <div className="mt-1 overflow-hidden rounded border border-paper-line-faint bg-white/60">
                {SUMMARY_QUESTIONS.map((question, index) => {
                  const checked = answers[index];
                  return (
                    <button
                      key={question}
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-1.5 border-b border-paper-line-faint px-1.5 py-1 text-left text-pc-xs leading-snug transition-colors last:border-0 hover:bg-paper-hover",
                        checked ? "text-ink" : "text-ink-muted",
                      )}
                      onClick={() => {
                        const next = [...answers];
                        next[index] = !next[index];
                        setAnswers(next);
                      }}
                    >
                      <span
                        className={cn(
                          "mt-px flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border",
                          checked
                            ? "border-ink bg-ink text-white"
                            : "border-paper-line-hover bg-white",
                        )}
                      >
                        {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                      </span>
                      <span className="flex-1">{question}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="mt-1 space-y-0.5 border-t border-dashed border-paper-line-faint pt-1">
            <div className="flex items-center justify-between">
              <span className="text-pc-sm">当前经验</span>
              <PaperStepper
                value={exp}
                min={0}
                max={BASE.expMax}
                onChange={(value) => setResource("exp", value)}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 text-pc-xs font-semibold text-ink-muted">花费经验</div>

          <div className="grid gap-1.5 sm:grid-cols-3">
            <UpgradeCard
              title="提升灵识"
              cost={GROWTH_COSTS.insight}
              description="从体魄、智慧、心魂中选择一项提升。"
              action={
                <MicroButton
                  className="w-full"
                  disabled={!insightAttribute || !canIncreaseInsight(character)}
                  onClick={() => {
                    if (insightAttribute) apply(tryIncreaseInsight(character, insightAttribute));
                  }}
                >
                  提升
                </MicroButton>
              }
            >
              <Select
                value={insightAttribute}
                onValueChange={(value) =>
                  setInsightAttribute(value === CLEAR_VALUE ? "" : (value as AttributeId))
                }
              >
                <SelectTrigger className="h-6 text-pc-sm">
                  <SelectValue placeholder="选择属性" />
                </SelectTrigger>
                <SelectContent>
                  {insightAttribute ? (
                    <SelectItem value={CLEAR_VALUE} className="text-ink-hint">
                      清除选择
                    </SelectItem>
                  ) : null}
                  {(Object.keys(ATTRIBUTE_LABEL) as AttributeId[]).map((attribute) => (
                    <SelectItem key={attribute} value={attribute}>
                      {ATTRIBUTE_LABEL[attribute]} {character.attributes[attribute]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </UpgradeCard>

            <UpgradeCard
              title="锻造印记"
              cost={GROWTH_COSTS.imprint}
              description="锻造一枚新的灵能印记。"
              action={
                <MicroButton
                  className="w-full"
                  disabled={!canCreateImprint(character) || !imprintId}
                  onClick={() => {
                    apply(tryCreateImprint(character, imprintId));
                    setImprintId("");
                  }}
                >
                  锻造
                </MicroButton>
              }
            >
              <Select
                value={imprintId}
                onValueChange={(value) => setImprintId(value === CLEAR_VALUE ? "" : value)}
              >
                <SelectTrigger className="h-6 text-pc-sm">
                  <SelectValue
                    placeholder={imprintOptions.length > 0 ? "选择印记" : "暂无可锻造印记"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {imprintOptions.length > 0 ? (
                    <>
                      {imprintId ? (
                        <SelectItem value={CLEAR_VALUE} className="text-ink-hint">
                          清除选择
                        </SelectItem>
                      ) : null}
                      {imprintOptions.map((card) => (
                        <SelectItem key={card.id} value={card.id}>
                          {card.name}
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    <div className="px-2 py-1.5 text-pc-xs text-ink-hint">
                      所有可用印记都已拥有
                    </div>
                  )}
                </SelectContent>
              </Select>
              {selectedImprint ? (
                <div className="rounded border border-paper-line-faint bg-paper-hover px-1.5 py-1">
                  <div className="flex items-center justify-between gap-1 text-pc-xs font-medium">
                    <span className="truncate">{selectedImprint.name}</span>
                    <span className="shrink-0 text-pc-xs font-normal text-ink-hint">效果</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-pc-xs leading-snug text-ink-soft">
                    {selectedImprint.description}
                  </p>
                </div>
              ) : (
                <p className="rounded border border-dashed border-paper-line-faint px-1.5 py-1.5 text-pc-xs leading-snug text-ink-hint">
                  {imprintOptions.length > 0 ? "选择印记后可预览效果。" : "已拥有全部可用印记。"}
                </p>
              )}
            </UpgradeCard>

            <UpgradeCard
              title="经历标签"
              cost={GROWTH_COSTS.experienceTag}
              description={replacing ? "替换一个已有标签。" : "创造一个 5～15 字的新标签。"}
              action={
                <MicroButton
                  className="w-full"
                  disabled={
                    exp < GROWTH_COSTS.experienceTag ||
                    !tag.trim() ||
                    (replacing && !replacedTag)
                  }
                  onClick={() => {
                    apply(
                      replacing
                        ? tryReplaceExperienceTag(character, replacedTag, tag)
                        : tryCreateExperienceTag(character, tag),
                    );
                    setTag("");
                    setReplacedTag("");
                  }}
                >
                  {replacing ? "替换" : "创造"}
                </MicroButton>
              }
            >
              {replacing ? (
                <Select value={replacedTag} onValueChange={setReplacedTag}>
                  <SelectTrigger className="h-6 text-pc-sm">
                    <SelectValue
                      placeholder={
                        character.experienceTags.length > 0 ? "选择要替换的标签" : "暂无可替换标签"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {character.experienceTags.length > 0 ? (
                      character.experienceTags.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-pc-xs text-ink-hint">暂无可替换标签</div>
                    )}
                  </SelectContent>
                </Select>
              ) : null}
              <Textarea
                value={tag}
                rows={2}
                onChange={(event) => setTag(event.target.value)}
                placeholder="5～15 个字"
                className="min-w-0"
                style={{ fontSize: 10, lineHeight: 1.4, minHeight: 34 }}
              />
            </UpgradeCard>
          </div>

          {error ? <p className="mt-1 text-pc-xs text-destructive">{error}</p> : null}
        </div>
      </div>
    </Block>
  );
}
