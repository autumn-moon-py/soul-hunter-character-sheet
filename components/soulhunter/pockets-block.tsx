"use client";

import { useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { Block } from "./paper-kit";

export function PocketsBlock() {
  const character = useCharacterStore((state) => state.character);
  const setPockets = useCharacterStore((state) => state.setPockets);
  const ref = useRef<HTMLTextAreaElement>(null);
  const value = character.pockets ?? "";

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <Block title="备注">
      <Textarea
        ref={ref}
        value={value}
        rows={4}
        aria-label="备注"
        data-export-editable="true"
        className="overflow-hidden"
        onChange={(event) => setPockets(event.target.value)}
      />
    </Block>
  );
}
