"use client";

import { memo, useMemo } from "react";

interface VoiceWaveformProps {
  level: number;
  active: boolean;
}

const BARS = 24;

function VoiceWaveformComponent({ level, active }: VoiceWaveformProps) {
  const clampedLevel = Math.max(0, Math.min(1, level));

  const bars = useMemo(() => {
    return Array.from({ length: BARS }).map((_, index) => {
      const distance = Math.abs(index - BARS / 2);
      const decay = 1 - distance / (BARS / 2);
      const height = Math.max(12, 120 * clampedLevel * decay);
      return { index, height };
    });
  }, [clampedLevel]);

  return (
    <div className="flex h-40 w-full items-center justify-center gap-[6px]">
      {bars.map((bar) => (
        <span
          key={bar.index}
          className="h-full w-[3px] rounded-full bg-cyan-300/30 transition-all duration-150 will-change-transform"
          style={{
            height: active ? `${bar.height}px` : "18px",
            boxShadow: active ? "0 0 12px rgba(111, 217, 255, 0.45)" : undefined,
          }}
        />
      ))}
    </div>
  );
}

export const VoiceWaveform = memo(VoiceWaveformComponent);

export default VoiceWaveform;
