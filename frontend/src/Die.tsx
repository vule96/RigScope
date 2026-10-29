import type { ReactNode } from "react";

import { type Chip, smCount } from "./chips";
import type { Sample } from "./gpu";

export type Block =
  | { kind: "chip" }
  | { kind: "pcie" }
  | { kind: "gigathread" }
  | { kind: "nvenc" }
  | { kind: "nvdec" }
  | { kind: "display" }
  | { kind: "gpc"; gpc: number }
  | { kind: "tpc"; gpc: number; tpc: number }
  | { kind: "sm"; gpc: number; tpc: number; sm: number }
  | { kind: "l2" }
  | { kind: "mc"; mc: number }
  | { kind: "mem"; chip: number };

const same = (a: Block, b: Block) => JSON.stringify(a) === JSON.stringify(b);

// Load shading: one hue, opacity = load. NVML reports whole-chip load, so every SM gets the same shade.
export const heat = (pct: number | null | undefined) => (pct ? `rgb(var(--signal-rgb) / ${(0.06 + (0.8 * pct) / 100).toFixed(3)})` : "transparent");

const W = 720;
const PAD = 16;
const INNER = W - 2 * PAD;

interface Props {
  chip: Chip;
  sample: Sample | null;
  selected: Block;
  onSelect: (b: Block) => void;
}

export function Die({ chip, sample, selected, onSelect }: Props) {
  const box = (block: Block, x: number, y: number, w: number, h: number, label: ReactNode, opts: { fill?: string; note?: string; small?: boolean } = {}) => (
    <g
      className="blk"
      data-selected={same(block, selected) || undefined}
      role="button"
      tabIndex={0}
      aria-label={typeof label === "string" ? label : block.kind}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(block);
        }
      }}
    >
      <rect x={x} y={y} width={w} height={h} style={opts.fill ? { fill: opts.fill } : undefined} />
      <text x={x + 6} y={y + (opts.small ? 11 : h / 2 + 4)} className={opts.small ? "lbl-s" : "lbl"}>
        {label}
      </text>
      {opts.note && (
        <text x={x + w - 6} y={y + h / 2 + 4} className="lbl-v" textAnchor="end">
          {opts.note}
        </text>
      )}
    </g>
  );

  // Top row: host link and the fixed-function media blocks.
  const top = 14;
  const pcieNote = sample?.pcieGen != null ? `đang Gen ${String(sample.pcieGen)} ×${String(sample.pcieWidth ?? "?")}` : "";
  const pct = (v: number | null | undefined) => (v == null ? "" : `${String(Math.round(v))}%`);

  const gpcTop = 86;
  const gpcH = 226;
  const gap = 10;
  const gpcW = (INNER - gap * (chip.gpcs - 1)) / chip.gpcs;
  const cols = 2;
  const rows = Math.ceil(chip.tpcsPerGpc / cols);
  const tpcW = (gpcW - 16 - 8 * (cols - 1)) / cols;
  const tpcH = (gpcH - 28 - 8 * (rows - 1) - 8) / rows;
  const smGap = 5;
  const smW = (tpcW - 10 - smGap * (chip.smsPerTpc - 1)) / chip.smsPerTpc;
  const smH = tpcH - 18;

  const gpcs = Array.from({ length: chip.gpcs }, (_, g) => {
    const gx = PAD + g * (gpcW + gap);
    return (
      <g key={g}>
        {box({ kind: "gpc", gpc: g }, gx, gpcTop, gpcW, gpcH, `GPC ${String(g + 1)} · Raster Engine`, { small: true })}
        {Array.from({ length: chip.tpcsPerGpc }, (_, t) => {
          const tx = gx + 8 + (t % cols) * (tpcW + 8);
          const ty = gpcTop + 20 + Math.floor(t / cols) * (tpcH + 8);
          const tpcIndex = g * chip.tpcsPerGpc + t;
          return (
            <g key={t}>
              {box({ kind: "tpc", gpc: g, tpc: tpcIndex }, tx, ty, tpcW, tpcH, `TPC ${String(tpcIndex + 1)}`, { small: true })}
              {Array.from({ length: chip.smsPerTpc }, (_, s) => {
                const sm = tpcIndex * chip.smsPerTpc + s;
                return (
                  <g key={s}>
                    {box({ kind: "sm", gpc: g, tpc: tpcIndex, sm }, tx + 5 + s * (smW + smGap), ty + 14, smW, smH, `SM ${String(sm + 1)}`, {
                      small: true,
                      fill: heat(sample?.gpu),
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>
    );
  });

  const l2Top = gpcTop + gpcH + 10;
  const mcTop = l2Top + 40;
  const mcs = chip.busBits / 32;
  const mcW = (INNER - gap * (mcs - 1)) / mcs;
  const perMc = chip.memChips / mcs;
  const memTop = mcTop + 36;
  const memW = (mcW - 8 * (perMc - 1)) / perMc;
  const H = memTop + 40 + 14;

  return (
    <svg
      className="die"
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      role="group"
      aria-label={`Sơ đồ khối ${chip.code}`}
      onClick={() => {
        onSelect({ kind: "chip" });
      }}
    >
      {box({ kind: "pcie" }, PAD, top, 396, 30, `${chip.pcie} · giao tiếp CPU`, { note: pcieNote })}
      {box({ kind: "nvenc" }, 420, top, 92, 30, "NVENC", { fill: heat(sample?.encoder), note: pct(sample?.encoder) })}
      {box({ kind: "nvdec" }, 520, top, 92, 30, "NVDEC", { fill: heat(sample?.decoder), note: pct(sample?.decoder) })}
      {box({ kind: "display" }, 620, top, W - PAD - 620, 30, "Display")}
      {box({ kind: "gigathread" }, PAD, 52, INNER, 22, "GigaThread Engine · chia việc cho các SM")}
      {gpcs}
      {box({ kind: "l2" }, PAD, l2Top, INNER, 30, `L2 cache · ${String(chip.l2Mb)} MB · dùng chung ${String(smCount(chip))} SM`)}
      {Array.from({ length: mcs }, (_, m) => {
        const mx = PAD + m * (mcW + gap);
        return (
          <g key={m}>
            <line x1={mx + mcW / 2} x2={mx + mcW / 2} y1={l2Top + 30} y2={mcTop} className="wire" />
            {box({ kind: "mc", mc: m }, mx, mcTop, mcW, 26, `Bộ điều khiển nhớ ${String(m + 1)} · 32-bit`, { fill: heat(sample?.memBusy) })}
            {Array.from({ length: perMc }, (_, c) => {
              const cx = mx + c * (memW + 8);
              const index = m * perMc + c;
              return (
                <g key={c}>
                  <line x1={cx + memW / 2} x2={cx + memW / 2} y1={mcTop + 26} y2={memTop} className="wire" />
                  {box({ kind: "mem", chip: index }, cx, memTop, memW, 40, `${chip.memType} ${String(chip.chipGb)} GB`, { small: true })}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
