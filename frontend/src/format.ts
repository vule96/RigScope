const fmts = new Map<number, Intl.NumberFormat>();

/** Vietnamese number format ("2.572", "15,2"); "—" when the driver gives nothing. */
export function num(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  let f = fmts.get(digits);
  if (!f) {
    f = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
    fmts.set(digits, f);
  }
  return f.format(v);
}

export const gib = (mib: number | null | undefined) => (mib == null ? null : mib / 1024);

export const REASONS: Record<string, string> = {
  idle: "Đang rảnh, driver hạ xung để tiết kiệm điện",
  app_clocks: "Xung bị khoá bởi cài đặt ứng dụng",
  sw_power_cap: "Chạm giới hạn công suất (power limit)",
  hw_slowdown: "Phần cứng tự hạ xung (nóng hoặc nguồn yếu)",
  sync_boost: "Đồng bộ xung với GPU khác",
  sw_thermal: "Nóng: driver hạ xung để giữ nhiệt",
  hw_thermal: "Quá nóng: phần cứng hạ xung",
  power_brake: "Nguồn ngoài yêu cầu giảm công suất",
  display_clock: "Xung bị giữ theo màn hình",
};
