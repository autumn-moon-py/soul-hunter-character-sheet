"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BASE_MARTIAL_ID } from "@/src/content";
import { BASE } from "@/src/rules/constants";
import { derive } from "@/src/rules/derive";
import { baseSpellCount } from "@/src/rules/quotas";
import { validate } from "@/src/rules/validate";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { QuotaBar } from "./ui-bits";

function Status({ tone, children }: { tone: "ok" | "error" | "warn"; children: React.ReactNode }) {
  const styles =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "error"
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      {children}
    </span>
  );
}

export function CheckDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const character = useCharacterStore((state) => state.character);
  const derived = useMemo(() => derive(character), [character]);
  const issues = useMemo(
    () =>
      validate(character, {
        mode: character.insight > BASE.insight ? "advancement" : "creation",
      }),
    [character],
  );
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  const martialUsed =
    character.selections.martialArtIds.length -
    (character.selections.martialArtIds.includes(BASE_MARTIAL_ID) ? 1 : 0);
  const spellUsed = Math.max(
    0,
    character.selections.spellIds.length - baseSpellCount(character.attributes.mind),
  );
  const ultimateUsed =
    Number(Boolean(character.selections.ultimateTier1Id)) +
    Number(Boolean(character.selections.ultimateTier2Id));

  const quotas = [
    { label: "武技", used: martialUsed, max: derived.quotas.martialArts },
    { label: "术法", used: spellUsed, max: derived.quotas.spells },
    { label: "专长", used: character.selections.specialtyIds.length, max: derived.quotas.specialties },
    { label: "灵能印记", used: character.selections.imprintIds.length, max: derived.quotas.imprints },
    { label: "绝技", used: ultimateUsed, max: derived.quotas.ultimates },
  ].filter((item) => item.max > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-surface grid-cols-1 gap-0 max-h-[85vh] w-[min(560px,calc(100vw-1rem))] overflow-y-auto p-0">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="text-base">建卡检查</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {errors.length === 0 ? (
              <Status tone="ok">
                <CheckCircle2 className="h-3.5 w-3.5" />
                无阻断错误
              </Status>
            ) : (
              <Status tone="error">
                <CircleAlert className="h-3.5 w-3.5" />
                {errors.length} 个错误
              </Status>
            )}
            {warnings.length > 0 ? (
              <Status tone="warn">
                <AlertTriangle className="h-3.5 w-3.5" />
                {warnings.length} 个提醒
              </Status>
            ) : null}
          </div>

          {issues.length > 0 ? (
            <div className="space-y-1.5">
              {issues.map((issue, index) => (
                <div
                  key={`${issue.code}-${index}`}
                  className={
                    issue.level === "error"
                      ? "rounded border-l-2 border-destructive bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive"
                      : issue.level === "warning"
                        ? "rounded border-l-2 border-amber-400 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700"
                        : "rounded border-l-2 border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground"
                  }
                >
                  {issue.message}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">当前角色符合建卡规则。</p>
          )}

          {quotas.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">配额</h3>
              {quotas.map((item) => (
                <QuotaBar key={item.label} label={item.label} used={item.used} max={item.max} />
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
