import { bandwidthGBs, type Chip, smCount } from "./chips";
import { type Block, heat } from "./Die";
import { gib, num } from "./format";
import type { Sample, Card } from "./gpu";

interface Doc {
  title: string;
  body: string[];
  facts: [string, string][];
}

function describe(b: Block, c: Chip, st: Card, s: Sample | null): Doc {
  const sms = smCount(c);
  const pct = (v: number | null | undefined) => `${num(v)}%`;
  switch (b.kind) {
    case "chip":
      return {
        title: `${c.code} · ${c.arch}`,
        body: [
          "Bấm vào một khối trên sơ đồ để xem nó làm gì. Màu cam đậm dần theo tải: SM theo % GPU, bộ điều khiển nhớ theo % bộ nhớ bận, NVENC/NVDEC theo % của riêng chúng.",
        ],
        facts: [
          ["Tiến trình", `${c.process} · ${num(c.dieMm2)} mm² · ${num(c.transistorsB, 1)} tỉ transistor`],
          ["CUDA core", num(sms * c.coresPerSm)],
          ["Tensor core", `${num(sms * c.tensorPerSm)} · thế hệ ${String(c.tensorGen)}`],
          ["RT core", `${num(sms)} · thế hệ ${String(c.rtGen)}`],
          ["TMU / ROP", `${num(sms * c.tmusPerSm)} / ${num(c.rops)}`],
          ["Bộ nhớ", `${num(c.memChips * c.chipGb)} GB ${c.memType} · ${String(c.busBits)}-bit · ${num(bandwidthGBs(c))} GB/s`],
          ["Xung", `${num(c.baseMHz)}–${num(c.boostMHz)} MHz (boost); driver cho tối đa ${num(st.maxGraphicsMHz)} MHz`],
          ["Công suất", `TGP ${num(c.tgpW)} W; giới hạn đang đặt ${num(s?.powerLimitW ?? st.powerDefaultW)} W`],
        ],
      };
    case "pcie":
      return {
        title: c.pcie,
        body: [
          "Đường nối card với CPU và RAM. Card này chỉ có 8 làn PCIe 5.0, khoảng 32 GB/s mỗi chiều. Vẫn đủ, vì khi chạy model đã nằm sẵn trong VRAM; nó chỉ chậm lúc nạp model, hoặc khi VRAM đầy phải tràn sang RAM.",
          "Lúc rảnh driver hạ xuống Gen 1 để tiết kiệm điện, nên số \"đang chạy\" sẽ nhảy.",
          ...(st.pcieGenMax != null && st.pcieGenMax < 5
            ? [
                `Bo mạch chủ máy này chỉ tới PCIe ${String(st.pcieGenMax)}.0, nên card chạy tối đa Gen ${String(st.pcieGenMax)} ×8 (khoảng ${String(8 * 2 ** (st.pcieGenMax - 3))} GB/s mỗi chiều). Ảnh hưởng thấy rõ nhất là lúc nạp model.`,
              ]
            : []),
        ],
        facts: [
          ["Card hỗ trợ", c.pcie],
          ["Máy này cho tối đa", `Gen ${num(st.pcieGenMax)}`],
          ["Đang chạy", `Gen ${num(s?.pcieGen)} ×${num(s?.pcieWidth)}`],
        ],
      };
    case "gigathread":
      return {
        title: "GigaThread Engine",
        body: [
          `Bộ phân việc. Driver gửi lệnh xuống, GigaThread chia các khối luồng (thread block) cho ${String(sms)} SM đang rảnh, và chuyển qua lại khi nhiều ứng dụng cùng dùng GPU.`,
        ],
        facts: [["Trạng thái nguồn", s?.pstate ? `${s.pstate} (P0 nhanh nhất, P8 rảnh)` : "—"]],
      };
    case "nvenc":
      return {
        title: "NVENC · mã hoá video",
        body: [
          "Mạch mã hoá video riêng (H.264, HEVC, AV1), không dùng CUDA core. OBS, Discord và ffmpeg (h264_nvenc, hevc_nvenc, av1_nvenc) dùng nó, nên vừa chạy AI vừa xuất video vẫn được.",
        ],
        facts: [
          ["Số lượng", c.nvenc],
          ["Đang dùng", pct(s?.encoder)],
        ],
      };
    case "nvdec":
      return {
        title: "NVDEC · giải mã video",
        body: ["Giải mã video bằng mạch riêng: xem YouTube, xem phim, hoặc ffmpeg đọc video đầu vào mà không tốn CPU."],
        facts: [
          ["Số lượng", c.nvdec],
          ["Đang dùng", pct(s?.decoder)],
        ],
      };
    case "display":
      return {
        title: "Display engine",
        body: ["Xuất hình ra màn hình qua DisplayPort 2.1b và HDMI 2.1b. Không tham gia tính toán."],
        facts: [],
      };
    case "gpc":
      return {
        title: `GPC ${String(b.gpc + 1)}`,
        body: [
          `Graphics Processing Cluster, một cụm xử lý đủ bộ: 1 Raster Engine (biến tam giác thành pixel khi chơi game) và ${String(c.tpcsPerGpc)} TPC = ${String(c.tpcsPerGpc * c.smsPerTpc)} SM.`,
          `${c.code} có ${String(c.gpcs)} GPC và card này dùng đủ ${String(sms)}/${String(sms)} SM, không khối nào bị khoá.`,
        ],
        facts: [],
      };
    case "tpc":
      return {
        title: `TPC ${String(b.tpc + 1)} · thuộc GPC ${String(b.gpc + 1)}`,
        body: [
          "Texture Processing Cluster: 2 SM dùng chung một PolyMorph Engine (đọc đỉnh, tessellation, tức phần hình học của game). Với AI thì TPC không quan trọng, việc nặng nằm trong SM.",
        ],
        facts: [],
      };
    case "sm":
      return {
        title: `SM ${String(b.sm + 1)} · TPC ${String(b.tpc + 1)} · GPC ${String(b.gpc + 1)}`,
        body: [
          "Streaming Multiprocessor, nơi làm toán thật sự. Chia 4 phần; mỗi phần có bộ lập lịch warp riêng (một warp = 32 luồng chạy cùng một lệnh), 32 CUDA core và 1 Tensor core.",
          "Khi chạy FLUX hay Wan, phần lớn thời gian là nhân ma trận FP8/FP16 trên Tensor core; CUDA core lo phần còn lại (activation, normalize) và đồ hoạ game.",
          `Driver chỉ đo % cả chip nên mọi SM tô cùng màu: ${pct(s?.gpu)} nghĩa là ${pct(s?.gpu)} thời gian có ít nhất một kernel chạy, chưa chắc mọi SM đều bận.`,
        ],
        facts: [
          ["CUDA core", num(c.coresPerSm)],
          ["Tensor core", `${String(c.tensorPerSm)} · thế hệ ${String(c.tensorGen)} (FP4/FP8/FP16)`],
          ["RT core", `1 · thế hệ ${String(c.rtGen)}`],
          ["Register file", "256 KB (4 × 64 KB)"],
          ["L1 / shared memory", `${String(c.l1PerSmKb)} KB`],
        ],
      };
    case "l2":
      return {
        title: `L2 cache · ${String(c.l2Mb)} MB`,
        body: [
          `Bộ đệm chung cho cả ${String(sms)} SM. Dữ liệu được dùng lại (trọng số, texture) nằm ở đây thay vì đọc lại từ VRAM. L2 lớn là cách NVIDIA bù cho bus nhớ hẹp ${String(c.busBits)}-bit.`,
        ],
        facts: [],
      };
    case "mc":
      return {
        title: `Bộ điều khiển nhớ ${String(b.mc + 1)}`,
        body: [
          `Một kênh 32-bit nối với ${String(c.memChips / (c.busBits / 32))} chip ${c.memType}; ${String(c.busBits / 32)} kênh ghép thành bus ${String(c.busBits)}-bit.`,
          "Màu tô theo % bộ nhớ bận: tỉ lệ thời gian VRAM đang được đọc hoặc ghi. Khi chạy model mà % này gần bằng % GPU thì đang nghẽn ở băng thông nhớ chứ không phải ở sức tính.",
        ],
        facts: [
          ["Bộ nhớ bận", pct(s?.memBusy)],
          ["Xung bộ nhớ", `${num(s?.memoryMHz)} MHz (tối đa ${num(st.maxMemoryMHz)})`],
        ],
      };
    case "mem":
      return {
        title: `Chip nhớ ${String(b.chip + 1)} · ${c.memType} ${String(c.chipGb)} GB`,
        body: [
          `Card ${String(c.memChips * c.chipGb)} GB dùng ${String(c.memChips)} chip ${String(c.chipGb)} GB. Bus chỉ có ${String(c.busBits / 32)} kênh nên mỗi kênh gánh 2 chip (clamshell, thường gắn ở hai mặt bo mạch).`,
          `Băng thông: ${String(c.memGbps)} Gbps × ${String(c.busBits)} bit ÷ 8 = ${num(bandwidthGBs(c))} GB/s. Dữ liệu được rải đều qua mọi chip, nên không có chuyện chip 1 đầy trước.`,
        ],
        facts: [["VRAM đang dùng", `${num(gib(s?.memUsedMiB), 1)} / ${num(gib(s?.memTotalMiB ?? st.memTotalMiB), 1)} GB`]],
      };
  }
}

export function Detail({ block, chip, stat, sample }: { block: Block; chip: Chip; stat: Card; sample: Sample | null }) {
  const doc = describe(block, chip, stat, sample);
  return (
    <section className="detail" aria-live="polite">
      <div className="detail-text">
        <h2>{doc.title}</h2>
        {doc.body.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
        {doc.facts.length > 0 && (
          <dl>
            {doc.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      {block.kind === "sm" && <SmDrawing chip={chip} load={sample?.gpu ?? null} />}
    </section>
  );
}

function SmDrawing({ chip, load }: { chip: Chip; load: number | null }) {
  const W = 300;
  const parts = 4;
  const pw = (W - 3 * 6) / parts;
  const perPart = chip.coresPerSm / parts;
  const coreCols = 4;
  const cell = (pw - 10) / coreCols;
  const coreRows = Math.ceil(perPart / coreCols);
  const coresTop = 58;
  const tensorTop = coresTop + coreRows * cell + 6;
  const bottom = tensorTop + 30;
  return (
    <svg className="sm" viewBox={`0 0 ${String(W)} ${String(bottom + 64)}`} role="img" aria-label="Bên trong một SM">
      {Array.from({ length: parts }, (_, p) => {
        const x = p * (pw + 6);
        return (
          <g key={p}>
            <rect x={x} y={0} width={pw} height={tensorTop + 26} className="frame" />
            <rect x={x + 5} y={5} width={pw - 10} height={20} />
            <text x={x + pw / 2} y={18} textAnchor="middle" className="lbl-s">
              Warp sched.
            </text>
            <rect x={x + 5} y={30} width={pw - 10} height={22} />
            <text x={x + pw / 2} y={44} textAnchor="middle" className="lbl-s">
              Reg 64 KB
            </text>
            {Array.from({ length: perPart }, (_, i) => (
              <rect
                key={i}
                x={x + 5 + (i % coreCols) * cell + 0.75}
                y={coresTop + Math.floor(i / coreCols) * cell + 0.75}
                width={cell - 1.5}
                height={cell - 1.5}
                className="core"
                style={{ fill: heat(load) }}
              />
            ))}
            <rect x={x + 5} y={tensorTop} width={pw - 10} height={20} className="tensor" />
            <text x={x + pw / 2} y={tensorTop + 13} textAnchor="middle" className="lbl-s">
              Tensor
            </text>
          </g>
        );
      })}
      {(
        [
          [0, "RT core"],
          [1, `${String(chip.tmusPerSm)} TMU`],
          [2, `L1 ${String(chip.l1PerSmKb)} KB`],
        ] as const
      ).map(([i, label]) => {
        const bw = (W - 12) / 3;
        return (
          <g key={i}>
            <rect x={i * (bw + 6)} y={bottom} width={bw} height={26} />
            <text x={i * (bw + 6) + bw / 2} y={bottom + 17} textAnchor="middle" className="lbl-s">
              {label}
            </text>
          </g>
        );
      })}
      <text x={0} y={bottom + 50} className="lbl-s muted">
        {`Mỗi ô nhỏ là 1 CUDA core · ${String(chip.coresPerSm)} ô = 1 SM`}
      </text>
    </svg>
  );
}
