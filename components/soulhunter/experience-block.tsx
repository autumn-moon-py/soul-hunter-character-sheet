"use client";

import { useLayoutEffect, useRef } from "react";
import { X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useCharacterStore } from "@/lib/soulhunter/store";
import { Block } from "./paper-kit";

function TagRow({
  tag,
  index,
  onChange,
  onRemove,
}: {
  tag: string;
  index: number;
  onChange: (value: string) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // 按内容撑高，长标签自动换行，避免在单行输入框里被截断
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [tag]);

  return (
    <div className="group flex items-start gap-1 rounded border border-[#e8e2d6] bg-white/60 px-1.5 py-1 focus-within:border-[#c9c0ad]">
      <Textarea
        ref={ref}
        rows={1}
        value={tag}
        aria-label={`经历标签 ${index + 1}`}
        placeholder="5～15 个字"
        className="tag-input min-h-0 flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        style={{ minHeight: 0, fontSize: 11, lineHeight: 1.45, padding: "1px 0" }}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // 标签保持单段文本，回车直接结束编辑而不是插入换行
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        aria-label={`移除经历标签 ${index + 1}`}
        className="mt-[1px] shrink-0 text-[#8b8474] opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function ExperienceBlock() {
  const character = useCharacterStore((state) => state.character);
  const setExperienceTags = useCharacterStore((state) => state.setExperienceTags);
  const tags = character.experienceTags;

  return (
    <Block title="经历标签" meta={`${tags.length} / 3`}>
      <div className="space-y-1">
        {tags.map((tag, index) => (
          <TagRow
            key={index}
            tag={tag}
            index={index}
            onChange={(value) => {
              const next = [...tags];
              next[index] = value;
              setExperienceTags(next);
            }}
            onRemove={() => setExperienceTags(tags.filter((_, itemIndex) => itemIndex !== index))}
          />
        ))}

        {tags.length < 3 ? (
          <button
            type="button"
            className="flex w-full items-center justify-center rounded border border-dashed border-[#d9d2c4] py-1 text-[10px] text-[#8b8474] transition-colors hover:border-[#a1a1aa] hover:text-[#232323]"
            onClick={() => setExperienceTags([...tags, ""])}
          >
            + 添加经历标签
          </button>
        ) : null}
      </div>
    </Block>
  );
}
