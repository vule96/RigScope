// What nvidia-smi cannot tell: the layout inside the chip. One entry per card we have checked specs for.
export interface Chip {
  match: RegExp;
  code: string;
  arch: string;
  process: string;
  dieMm2: number;
  transistorsB: number;
  gpcs: number;
  tpcsPerGpc: number;
  smsPerTpc: number;
  coresPerSm: number;
  tensorPerSm: number;
  tensorGen: number;
  rtGen: number;
  tmusPerSm: number;
  rops: number;
  l1PerSmKb: number;
  l2Mb: number;
  busBits: number;
  memChips: number;
  chipGb: number;
  memType: string;
  memGbps: number;
  baseMHz: number;
  boostMHz: number;
  tgpW: number;
  pcie: string;
  nvenc: string;
  nvdec: string;
}

// Sources: NVIDIA RTX 50 spec table via ThePCEnthusiast, KitGuru and Club386 reviews (April 2025).
export const CHIPS: Chip[] = [
  {
    match: /RTX 5060 Ti/i,
    code: "GB206",
    arch: "Blackwell",
    process: "TSMC 4N",
    dieMm2: 181,
    transistorsB: 21.9,
    gpcs: 3,
    tpcsPerGpc: 6,
    smsPerTpc: 2,
    coresPerSm: 128,
    tensorPerSm: 4,
    tensorGen: 5,
    rtGen: 4,
    tmusPerSm: 4,
    rops: 48,
    l1PerSmKb: 128,
    l2Mb: 32,
    busBits: 128,
    memChips: 8,
    chipGb: 2,
    memType: "GDDR7",
    memGbps: 28,
    baseMHz: 2407,
    boostMHz: 2572,
    tgpW: 180,
    pcie: "PCIe 5.0 ×8",
    nvenc: "1 × thế hệ 9",
    nvdec: "1 × thế hệ 6",
  },
];

export const findChip = (name: string) => CHIPS.find((c) => c.match.test(name));

export const smCount = (c: Chip) => c.gpcs * c.tpcsPerGpc * c.smsPerTpc;
export const bandwidthGBs = (c: Chip) => (c.memGbps * c.busBits) / 8;
