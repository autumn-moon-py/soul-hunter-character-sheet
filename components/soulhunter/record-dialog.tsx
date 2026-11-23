"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildDiceBotCommand, copyText } from "@/lib/soulhunter/export-record";
import { useCharacterStore } from "@/lib/soulhunter/store";

export function RecordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const character = useCharacterStore((state) => state.character);
  const dice = useMemo(() => buildDiceBotCommand(character), [character]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyText(dice);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-surface grid-cols-1 gap-0 w-[min(560px,calc(100vw-1rem))] p-0" hideClose>
        <DialogHeader className="flex-row items-center justify-between space-y-0 border-b px-5 py-3 text-left">
          <DialogTitle className="text-base">骰娘导出</DialogTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" />
                已复制
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3.5 w-3.5" />
                复制
              </>
            )}
          </Button>
        </DialogHeader>

        <div className="px-5 pb-4 pt-2">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <code className="block select-all break-all font-mono text-xs leading-relaxed text-zinc-700">
              {dice}
            </code>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
