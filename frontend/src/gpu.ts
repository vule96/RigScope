// Mirrors smi.Card / smi.Sample / main.Snapshot in Go. null = the driver does not report it on this card.
export interface Card {
  name: string;
  driver: string;
  vbios: string;
  memTotalMiB: number | null;
  powerDefaultW: number | null;
  maxGraphicsMHz: number | null;
  maxMemoryMHz: number | null;
  pcieGenMax: number | null;
}

export interface Sample {
  gpu: number | null;
  memBusy: number | null;
  encoder: number | null;
  decoder: number | null;
  memUsedMiB: number | null;
  memTotalMiB: number | null;
  tempC: number | null;
  fanPct: number | null;
  powerW: number | null;
  powerLimitW: number | null;
  graphicsMHz: number | null;
  memoryMHz: number | null;
  pcieGen: number | null;
  pcieWidth: number | null;
  pstate: string;
  reasons: string[] | null;
}

export interface Snapshot {
  card: Card;
  error: string;
  intervalMs: number;
}

// Globals Wails injects into the page; used directly so the frontend builds without generated bindings.
declare global {
  interface Window {
    go?: { main: { App: { Snapshot(): Promise<Snapshot> } } };
    runtime?: { EventsOn(name: string, cb: (data: never) => void): () => void };
  }
}

export interface Feed {
  snapshot: Promise<Snapshot>;
  subscribe(onSample: (s: Sample) => void, onError: (msg: string) => void): () => void;
}

export function connect(): Feed {
  const go = window.go;
  const rt = window.runtime;
  if (go && rt) {
    return {
      snapshot: go.main.App.Snapshot(),
      subscribe(onSample, onError) {
        const offs = [rt.EventsOn("sample", onSample as (d: never) => void), rt.EventsOn("smi-error", onError as (d: never) => void)];
        return () => {
          offs.forEach((off) => {
            off();
          });
        };
      },
    };
  }
  if (import.meta.env.DEV) return mockFeed();
  const error = "Không chạy trong Wails: mở bằng rig-scope.exe hoặc wails dev.";
  return { snapshot: Promise.resolve({ card: emptyCard, error, intervalMs: 1000 }), subscribe: () => () => undefined };
}

const emptyCard: Card = {
  name: "",
  driver: "",
  vbios: "",
  memTotalMiB: null,
  powerDefaultW: null,
  maxGraphicsMHz: null,
  maxMemoryMHz: null,
  pcieGenMax: null,
};

// Browser-only stand-in so the UI can be worked on without an NVIDIA card (`npm run dev`).
function mockFeed(): Feed {
  const total = 16311;
  return {
    snapshot: Promise.resolve({
      card: {
        name: "NVIDIA GeForce RTX 5060 Ti",
        driver: "581.57",
        vbios: "98.06.1f.00.9b",
        memTotalMiB: total,
        powerDefaultW: 180,
        maxGraphicsMHz: 3090,
        maxMemoryMHz: 14001,
        pcieGenMax: 4,
      },
      error: "",
      intervalMs: 1000,
    }),
    subscribe(onSample) {
      let t = 0;
      const id = setInterval(() => {
        t += 1;
        const load = Math.max(0, Math.min(100, 70 + 28 * Math.sin(t / 6) + (Math.random() - 0.5) * 12));
        const busy = load > 15;
        onSample({
          gpu: Math.round(load),
          memBusy: Math.round(load * 0.45),
          encoder: t % 40 < 12 ? 23 : 0,
          decoder: 0,
          memUsedMiB: 9800 + Math.round(load * 40),
          memTotalMiB: total,
          tempC: Math.round(48 + load * 0.2),
          fanPct: Math.round(30 + load * 0.3),
          powerW: Math.round((22 + load * 1.55) * 10) / 10,
          powerLimitW: 180,
          graphicsMHz: busy ? 2790 : 210,
          memoryMHz: busy ? 13801 : 405,
          pcieGen: busy ? 5 : 1,
          pcieWidth: 8,
          pstate: busy ? "P2" : "P8",
          reasons: busy ? (load > 90 ? ["sw_power_cap"] : []) : ["idle"],
        });
      }, 1000);
      return () => {
        clearInterval(id);
      };
    },
  };
}
