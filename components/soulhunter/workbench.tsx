"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { loadCharacter, saveCharacter } from "@/lib/soulhunter/storage";
import { Sheet } from "./sheet";

export default function Workbench() {
  const character = useCharacterStore((state) => state.character);
  const hydrated = useCharacterStore((state) => state.hydrated);
  const setHydrated = useCharacterStore((state) => state.setHydrated);
  const setCharacter = useCharacterStore((state) => state.setCharacter);

  useEffect(() => {
    const saved = loadCharacter();
    if (saved) {
      setCharacter(saved);
    }
    setHydrated(true);
  }, [setCharacter, setHydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => {
      saveCharacter(character);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [character, hydrated]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        正在读取本地存档……
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <main id="workbench-main" className="mx-auto max-w-[1100px] px-4 py-5 lg:px-6">
        <Sheet />
      </main>
      <span className="no-print pointer-events-none fixed bottom-1 right-2 z-20 text-[10px] leading-none text-zinc-400">
        {process.env.NEXT_PUBLIC_APP_VERSION}
      </span>
    </div>
  );
}
