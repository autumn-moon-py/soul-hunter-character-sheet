"use client";

import { ABILITY_SPECIALTIES } from "@/src/rules/constants";
import { CompactUltimateBlock } from "./compact-ultimate";
import { GrowthPanel } from "./growth-panel";
import { Block, Paper } from "./paper-kit";
import { StyleBlock } from "./style-block";

export function PageTwo() {
  return (
    <Paper>
      <div className="space-y-2">
        <StyleBlock />
        <div className="grid gap-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <CompactUltimateBlock tier={1} />
          </div>
          <div className="md:col-span-2">
            <CompactUltimateBlock tier={2} />
          </div>
        </div>
        <GrowthPanel />
        <Block title="通用效果">
          <div className="grid gap-1.5 md:grid-cols-4">
            {ABILITY_SPECIALTIES.map((item) => (
              <div
                key={item.name}
                className="rounded border border-[#d9d2c4] bg-white/60 p-1.5"
              >
                <div className="text-[10px] font-semibold">{item.name}</div>
                <p className="mt-0.5 text-[9px] leading-snug text-[#6b6455]">
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
