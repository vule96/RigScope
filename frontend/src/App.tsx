import { useEffect, useMemo, useState } from "react";

import { findChip } from "./chips";
import { Detail } from "./Detail";
import { type Block, Die } from "./Die";
import { connect, type Sample, type Snapshot } from "./gpu";
import { num } from "./format";
import { HISTORY, Readouts } from "./Readouts";

const feed = connect();

export function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [streamError, setStreamError] = useState("");
  const [lastAt, setLastAt] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Block>({ kind: "chip" });

  useEffect(() => {
    let live = true;
    void feed.snapshot.then((s) => {
      if (live) setSnapshot(s);
    });
    const off = feed.subscribe(
      (s) => {
        setHistory((h) => [...h.slice(-(HISTORY - 1)), s]);
        setStreamError("");
        setLastAt(new Date());
      },
      setStreamError,
    );
    return () => {
      live = false;
      off();
    };
  }, []);

  const stat = snapshot?.card;
  const chip = useMemo(() => (stat ? findChip(stat.name) : undefined), [stat]);
  const sample = history.at(-1) ?? null;

  if (!snapshot || !stat) return <div className="boot">Đang đọc thông tin card…</div>;
  if (snapshot.error) {
    return (
      <div className="boot">
        <h1>Không đọc được GPU</h1>
        <p>{snapshot.error}</p>
      </div>
    );
  }

  const name = stat.name.replace(/^NVIDIA\s+/, "");
  return (
    <div className="shell">
      <header>
        <div>
          <h1>{name}</h1>
          <p className="mono muted">
            {chip ? `${chip.code} · ${chip.arch} · ${chip.process} · ` : ""}
            {num((stat.memTotalMiB ?? 0) / 1024, 0)} GB {chip?.memType ?? "VRAM"}
          </p>
        </div>
        <dl className="mono">
          <div>
            <dt>Driver</dt>
            <dd>{stat.driver}</dd>
          </div>
          <div>
            <dt>VBIOS</dt>
            <dd>{stat.vbios}</dd>
          </div>
          <div>
            <dt>Cập nhật</dt>
            <dd className={streamError ? "warn" : undefined}>{lastAt ? lastAt.toLocaleTimeString("vi-VN") : "đang chờ…"}</dd>
          </div>
        </dl>
      </header>
      {streamError && <p className="banner">{streamError}</p>}
      <main>
        <div className="left">
          <h3 className="eyebrow">Bên trong chip</h3>
          {chip ? (
            <>
              <Die chip={chip} sample={sample} selected={selected} onSelect={setSelected} />
              <Detail block={selected} chip={chip} stat={stat} sample={sample} />
            </>
          ) : (
            <p className="empty">
              Chưa có sơ đồ cho {name}. Sơ đồ khối cần thông số chip lấy từ tài liệu (thêm vào <code>frontend/src/chips.ts</code>); các chỉ số bên phải vẫn
              đúng với mọi card NVIDIA.
            </p>
          )}
        </div>
        <div className="right">
          <h3 className="eyebrow">Đang hoạt động</h3>
          <Readouts history={history} stat={stat} />
        </div>
      </main>
    </div>
  );
}
