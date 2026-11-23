"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, FileCode2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createInitialCharacter } from "@/src/rules/create-character";
import type { SoulHunterCharacter } from "@/src/types";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { cn } from "@/lib/utils";
import { importCharacterFile } from "@/lib/soulhunter/import-html";
import {
  deleteSave,
  duplicateSave,
  getCurrentSaveId,
  listSaves,
  loadSave,
  renameSave,
  saveCharacter,
  setCurrentSaveId,
  type SaveMeta,
} from "@/lib/soulhunter/storage";

function newId(): string {
  return `char-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SaveDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const character = useCharacterStore((state) => state.character);
  const setCharacter = useCharacterStore((state) => state.setCharacter);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const htmlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSaves(listSaves());
    setCurrentId(getCurrentSaveId());
    setRenamingId(null);
    setImportError(null);
  }, [open]);

  const createNew = () => {
    const next = createInitialCharacter(newId());
    saveCharacter(next);
    setCharacter(next);
    setSaves(listSaves());
    setCurrentId(next.id);
    onOpenChange(false);
  };

  const adoptImported = (imported: SoulHunterCharacter) => {
    const name = imported.saveName?.trim() || imported.identity.name.trim() || "无名";
    const next = { ...imported, saveName: name.endsWith("（导入）") ? name : `${name}（导入）` };
    saveCharacter(next);
    setCharacter(next);
    setSaves(listSaves());
    setCurrentId(next.id);
    onOpenChange(false);
  };

  const handleHtmlFile = async (file: File) => {
    const result = await importCharacterFile(file);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    adoptImported(result.character);
  };

  const switchTo = (id: string) => {
    const next = loadSave(id);
    if (!next) return;
    setCurrentSaveId(id);
    setCharacter(next);
    onOpenChange(false);
  };

  const startRename = (save: SaveMeta) => {
    setRenamingId(save.id);
    setRenameValue(save.name);
  };

  const commitRename = (save: SaveMeta) => {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || name === save.name) return;
    renameSave(save.id, name);
    if (save.id === character.id) {
      setCharacter({ ...character, saveName: name });
    }
    setSaves(listSaves());
  };

  const duplicate = (id: string) => {
    duplicateSave(id);
    setSaves(listSaves());
  };

  const remove = (id: string) => {
    if (!window.confirm("确定删除这个存档吗？此操作不可撤销。")) return;

    const wasCurrent = character.id === id;
    const nextId = deleteSave(id);
    setSaves(listSaves());
    setCurrentId(getCurrentSaveId());

    // 删除的不是当前存档，纸面保持不变
    if (!wasCurrent) return;

    if (nextId) {
      const next = loadSave(nextId);
      if (next) {
        setCurrentSaveId(nextId);
        setCharacter(next);
        onOpenChange(false);
        return;
      }
    }

    // 没有剩余存档，新建空白角色，避免纸面停在已删除的数据上
    const blank = createInitialCharacter(newId());
    saveCharacter(blank);
    setCharacter(blank);
    setSaves(listSaves());
    setCurrentId(blank.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-surface grid-cols-1 gap-0 w-[min(560px,calc(100vw-1rem))] p-0">
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="text-base">存档管理</DialogTitle>
        </DialogHeader>

        <div className="max-h-[52vh] space-y-2 overflow-y-auto px-5 py-2">
          {saves.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              还没有存档，点击下方「新建存档」开始。
            </p>
          ) : (
            saves.map((save, index) => {
              const active = save.id === currentId;
              return (
                <div
                  key={save.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!active && renamingId !== save.id) switchTo(save.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !active && renamingId !== save.id) {
                      switchTo(save.id);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                    active
                      ? "cursor-default border-paper-line-hover bg-paper-hover"
                      : "cursor-pointer border-zinc-200 hover:bg-zinc-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                      active ? "bg-paper-tint text-ink-soft" : "bg-zinc-100 text-zinc-500",
                    )}
                  >
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    {renamingId === save.id ? (
                      <Input
                        autoFocus
                        value={renameValue}
                        className="h-7 text-sm"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={() => commitRename(save)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{save.name}</span>
                          {save.codename ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {save.codename}
                            </span>
                          ) : null}
                          {active ? (
                            <span className="rounded bg-paper-tint px-1 text-xs leading-4 text-ink-soft">
                              当前
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          灵识 {save.insight} · {formatTime(save.updatedAt)}
                        </div>
                      </>
                    )}
                  </div>

                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="重命名"
                      aria-label={`重命名${save.name}`}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => startRename(save)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="复制"
                      aria-label={`复制${save.name}`}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => duplicate(save.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      title="删除"
                      aria-label={`删除${save.name}`}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(save.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t px-5 py-3">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full border-paper-line-hover bg-paper-hover text-ink-soft hover:bg-paper-tint hover:text-ink-soft"
              onClick={createNew}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              新建存档
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full border-sky-600 text-sky-700 hover:bg-sky-50 hover:text-sky-700"
              onClick={() => htmlInputRef.current?.click()}
            >
              <FileCode2 className="mr-1.5 h-3.5 w-3.5" />
              从 HTML 导入
            </Button>
          </div>
          {importError ? (
            <p className="mt-2 text-xs text-destructive">{importError}</p>
          ) : null}
        </div>

        <input
          ref={htmlInputRef}
          type="file"
          accept=".html,.htm"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleHtmlFile(file);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
