import type { ReactNode } from "react";

import { gib, num, REASONS } from "./format";
import type { Sample, Card } from "./gpu";

const SPARK_W = 240;
const SPARK_H = 34;

function Spark({ values, max }: { values: (number | null)[]; max: number }) {
  const n = values.length;
  const step = SPARK_W / Math.max(1, HISTORY - 1);
  const offset = (HISTORY - n) * step;
  let d = "";
  values.forEach((v, i) => {
    if (v == null) return;
    const y = SPARK_H - 1 - (Math.min(v, max) / max) * (SPARK_H - 2);
    d += `${d === "" || values[i - 1] == null ? "M" : "L"}${(offset + i * step).toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg className="spark" viewBox={`0 0 ${String(SPARK_W)} ${String(SPARK_H)}`} preserveAspectRatio="none" aria-hidden>
      <line x1={0} x2={SPARK_W} y1={SPARK_H - 0.5} y2={SPARK_H - 0.5} className="base" />
      <path d={d} />
    </svg>
  );
}

export const HISTORY = 60;

function Row({ label, value, unit, sub, children }: { label: string; value: string; unit: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="row">
      <div className="row-head">
        <span className="row-label">{label}</span>
        <span className="row-value">
          {value}
          <small>{unit}</small>
        </span>
      </div>
      {children}
      {sub != null && <div className="row-sub">{sub}</div>}
    </div>
  );
}

function VramCells({ used, total }: { used: number | null; total: number | null }) {
  if (used == null || total == null || total <= 0) return null;
  const cells = Math.round(total);
  return (
    <div className="cells" role="img" aria-label={`Đã dùng ${num(used, 1)} trên ${num(total, 1)} GB`}>
      {Array.from({ length: cells }, (_, i) => {
        const fill = Math.max(0, Math.min(1, used - i));
        return (
          <span key={i}>
            <i style={{ width: `${String(fill * 100)}%` }} />
          </span>
        );
      })}
    </div>
  );
}

export function Readouts({ history, stat }: { history: Sample[]; stat: Card }) {
  const s = history.at(-1) ?? null;
  const series = (pick: (x: Sample) => number | null) => history.map(pick);
  const used = gib(s?.memUsedMiB);
  const total = gib(s?.memTotalMiB ?? stat.memTotalMiB);
  const limit = s?.powerLimitW ?? stat.powerDefaultW;
  const reasons = s?.reasons ?? [];

  return (
    <section className="readouts" aria-label="Chỉ số trực tiếp">
      <Row label="Lõi xử lý" value={num(s?.gpu)} unit="%" sub={`bộ nhớ bận ${num(s?.memBusy)}% · trạng thái ${s?.pstate || "—"}`}>
        <Spark values={series((x) => x.gpu)} max={100} />
      </Row>
      <Row
        label="VRAM"
        value={num(used, 1)}
        unit={`/ ${num(total, 0)} GB`}
        sub={used != null && total != null ? `còn trống ${num(total - used, 1)} GB` : undefined}
      >
        <VramCells used={used} total={total} />
      </Row>
      <Row label="Nhiệt độ" value={num(s?.tempC)} unit="°C" sub={`quạt ${num(s?.fanPct)}%`}>
        <Spark values={series((x) => x.tempC)} max={100} />
      </Row>
      <Row
        label="Công suất"
        value={num(s?.powerW)}
        unit="W"
        sub={`giới hạn ${num(limit)} W${s?.powerW != null && limit ? ` · đang dùng ${num((s.powerW / limit) * 100)}%` : ""}`}
      >
        <Spark values={series((x) => x.powerW)} max={limit ?? 200} />
      </Row>
      <Row label="Xung nhân" value={num(s?.graphicsMHz)} unit="MHz" sub={`tối đa ${num(stat.maxGraphicsMHz)} MHz · xung nhớ ${num(s?.memoryMHz)} MHz`}>
        <Spark values={series((x) => x.graphicsMHz)} max={stat.maxGraphicsMHz ?? 3000} />
      </Row>
      <Row label="Mã hoá / giải mã video" value={`${num(s?.encoder)} / ${num(s?.decoder)}`} unit="%" />
      <div className="row">
        <span className="row-label">Vì sao chưa chạy hết xung</span>
        <ul className="reasons">
          {s == null ? <li>—</li> : reasons.length === 0 ? <li>Không bị giới hạn</li> : reasons.map((r) => <li key={r}>{REASONS[r] ?? r}</li>)}
        </ul>
      </div>
      <p className="foot">Biểu đồ: {HISTORY} giây gần nhất.</p>
    </section>
  );
}
