"use client";

import { ABILITY_SPECIALTIES } from "@/src/rules/constants";
import { CompactUltimateBlock } from "./compact-ultimate";
import { GrowthPanel } from "./growth-panel";
import { Block, Paper } from "./paper-kit";
import { StyleBlock } from "./style-block";

export function PageTwo() {
  return (
    <Paper>
      <div className="space-y-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <StyleBlock />
          <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <CompactUltimateBlock tier={1} />
            <CompactUltimateBlock tier={2} />
          </div>
        </div>
        <GrowthPanel />
        <Block title="通用效果">
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {ABILITY_SPECIALTIES.map((item) => (
              <div
                key={item.name}
                className="rounded border border-paper-line bg-white/60 p-1.5"
              >
                <div className="text-pc-xs font-semibold">{item.name}</div>
                <p className="mt-0.5 text-pc-xs leading-snug text-ink-muted">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </Block>
      </div>
    </Paper>
  );
}
