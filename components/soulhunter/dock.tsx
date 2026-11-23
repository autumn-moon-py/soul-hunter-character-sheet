"use client";

import { useState } from "react";
import { Dices, Download, FolderOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCharacterHtml } from "@/lib/soulhunter/export-html";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { cn } from "@/lib/utils";
import { AiStatusButton } from "./ai-status-button";
import { CheckDialog } from "./check-dialog";
import { RecordDialog } from "./record-dialog";
import { SaveDialog } from "./save-dialog";

export type PageKey = "one" | "two";

const PAGES = [
  ["one", "第一页"],
  ["two", "第二页"],
] as const;

export function Dock({
  page,
  onPageChange,
}: {
  page: PageKey;
  onPageChange: (page: PageKey) => void;
}) {
  const character = useCharacterStore((state) => state.character);
  const [checkOpen, setCheckOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);

  return (
    <>
      <div className="no-print fixed inset-x-0 bottom-3 z-30 flex justify-center px-3">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[#e4e4e7] bg-white/95 px-1.5 py-1.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
          <div className="flex shrink-0 items-center gap-0.5">
            {PAGES.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onPageChange(key)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  page === key
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="mx-1 h-5 w-px shrink-0 bg-[#e4e4e7]" />

          <button
            type="button"
            onClick={() => exportCharacterHtml(character)}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            <Download className="h-3.5 w-3.5" />
            导出
          </button>
          <button
            type="button"
            onClick={() => setRecordOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
          >
            <Dices className="h-3.5 w-3.5" />
            骰娘导出
          </button>
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            存档
          </button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="建卡检查"
            className="h-8 w-8 shrink-0 text-zinc-500 hover:text-zinc-900"
            onClick={() => setCheckOpen(true)}
          >
            <ShieldCheck className="h-4 w-4" />
          </Button>

          <span className="mx-1 h-5 w-px shrink-0 bg-[#e4e4e7]" />

          <AiStatusButton />
        </div>
      </div>

      <CheckDialog open={checkOpen} onOpenChange={setCheckOpen} />
      <SaveDialog open={saveOpen} onOpenChange={setSaveOpen} />
      <RecordDialog open={recordOpen} onOpenChange={setRecordOpen} />
    </>
  );
}
