// Package smi reads NVIDIA GPU telemetry through nvidia-smi, which ships with every driver (no cgo, no NVML binding).
package smi

import (
	"encoding/csv"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Card describes the card; read once.
type Card struct {
	Name           string   `json:"name"`
	Driver         string   `json:"driver"`
	VBIOS          string   `json:"vbios"`
	MemTotalMiB    *float64 `json:"memTotalMiB"`
	PowerDefaultW  *float64 `json:"powerDefaultW"`
	MaxGraphicsMHz *float64 `json:"maxGraphicsMHz"`
	MaxMemoryMHz   *float64 `json:"maxMemoryMHz"`
	PCIeGenMax     *float64 `json:"pcieGenMax"` // limited by the motherboard slot, not just the card
}

// Sample is one reading. nil means the driver does not report that value on this card.
type Sample struct {
	GPU         *float64 `json:"gpu"`     // % of time at least one kernel ran
	MemBusy     *float64 `json:"memBusy"` // % of time device memory was read or written
	Encoder     *float64 `json:"encoder"`
	Decoder     *float64 `json:"decoder"`
	MemUsedMiB  *float64 `json:"memUsedMiB"`
	MemTotalMiB *float64 `json:"memTotalMiB"`
	TempC       *float64 `json:"tempC"`
	FanPct      *float64 `json:"fanPct"`
	PowerW      *float64 `json:"powerW"`
	PowerLimitW *float64 `json:"powerLimitW"`
	GraphicsMHz *float64 `json:"graphicsMHz"`
	MemoryMHz   *float64 `json:"memoryMHz"`
	PCIeGen     *float64 `json:"pcieGen"`
	PCIeWidth   *float64 `json:"pcieWidth"`
	PState      string   `json:"pstate"`
	Reasons     []string `json:"reasons"` // why clocks are below max, see reasonBits
}

// column maps one CSV value onto a field. Several names: drivers rename fields, the first supported one wins.
type column[T any] struct {
	names []string
	set   func(*T, string)
}

func num[T any](field func(*T) **float64) func(*T, string) {
	return func(t *T, v string) { *field(t) = parseNum(v) }
}

func text[T any](field func(*T) *string) func(*T, string) {
	return func(t *T, v string) {
		if !missing(v) {
			*field(t) = v
		}
	}
}

var cardColumns = []column[Card]{
	{[]string{"name"}, text(func(s *Card) *string { return &s.Name })},
	{[]string{"driver_version"}, text(func(s *Card) *string { return &s.Driver })},
	{[]string{"vbios_version"}, text(func(s *Card) *string { return &s.VBIOS })},
	{[]string{"memory.total"}, num(func(s *Card) **float64 { return &s.MemTotalMiB })},
	{[]string{"power.default_limit"}, num(func(s *Card) **float64 { return &s.PowerDefaultW })},
	{[]string{"clocks.max.graphics"}, num(func(s *Card) **float64 { return &s.MaxGraphicsMHz })},
	{[]string{"clocks.max.memory"}, num(func(s *Card) **float64 { return &s.MaxMemoryMHz })},
	{[]string{"pcie.link.gen.max"}, num(func(s *Card) **float64 { return &s.PCIeGenMax })},
}

var liveColumns = []column[Sample]{
	{[]string{"utilization.gpu"}, num(func(s *Sample) **float64 { return &s.GPU })},
	{[]string{"utilization.memory"}, num(func(s *Sample) **float64 { return &s.MemBusy })},
	{[]string{"utilization.encoder"}, num(func(s *Sample) **float64 { return &s.Encoder })},
	{[]string{"utilization.decoder"}, num(func(s *Sample) **float64 { return &s.Decoder })},
	{[]string{"memory.used"}, num(func(s *Sample) **float64 { return &s.MemUsedMiB })},
	{[]string{"memory.total"}, num(func(s *Sample) **float64 { return &s.MemTotalMiB })},
	{[]string{"temperature.gpu"}, num(func(s *Sample) **float64 { return &s.TempC })},
	{[]string{"fan.speed"}, num(func(s *Sample) **float64 { return &s.FanPct })},
	{[]string{"power.draw", "power.draw.instant"}, num(func(s *Sample) **float64 { return &s.PowerW })},
	{[]string{"power.limit", "enforced.power.limit"}, num(func(s *Sample) **float64 { return &s.PowerLimitW })},
	{[]string{"clocks.gr", "clocks.current.graphics"}, num(func(s *Sample) **float64 { return &s.GraphicsMHz })},
	{[]string{"clocks.mem", "clocks.current.memory"}, num(func(s *Sample) **float64 { return &s.MemoryMHz })},
	{[]string{"pcie.link.gen.current", "pcie.link.gen.gpucurrent"}, num(func(s *Sample) **float64 { return &s.PCIeGen })},
	{[]string{"pcie.link.width.current"}, num(func(s *Sample) **float64 { return &s.PCIeWidth })},
	{[]string{"pstate"}, text(func(s *Sample) *string { return &s.PState })},
	{[]string{"clocks_event_reasons.active", "clocks_throttle_reasons.active"}, func(s *Sample, v string) { s.Reasons = decodeReasons(v) }},
}

type query[T any] struct {
	fields []string
	sets   []func(*T, string)
}

// build keeps the columns this driver knows: one unknown field makes nvidia-smi reject the whole query.
// supported == nil (help unavailable) tries the first name of every column.
func build[T any](cols []column[T], supported map[string]bool) query[T] {
	var q query[T]
	for _, c := range cols {
		for _, n := range c.names {
			if supported == nil || supported[n] {
				q.fields = append(q.fields, n)
				q.sets = append(q.sets, c.set)
				break
			}
		}
	}
	return q
}

func (q query[T]) arg() string { return "--query-gpu=" + strings.Join(q.fields, ",") }

func (q query[T]) parse(line string) (T, error) {
	var t T
	r := csv.NewReader(strings.NewReader(line))
	r.TrimLeadingSpace = true
	rec, err := r.Read()
	if err != nil {
		return t, fmt.Errorf("nvidia-smi trả về dòng lạ %q: %w", line, err)
	}
	if len(rec) != len(q.sets) {
		return t, fmt.Errorf("nvidia-smi trả về %d cột, cần %d: %q", len(rec), len(q.sets), line)
	}
	for i, v := range rec {
		q.sets[i](&t, strings.TrimSpace(v))
	}
	return t, nil
}

var helpField = regexp.MustCompile(`"([a-z0-9_.]+)"`)

// supportedFields lists the quoted field names in `nvidia-smi --help-query-gpu`.
func supportedFields(help string) map[string]bool {
	m := map[string]bool{}
	for _, g := range helpField.FindAllStringSubmatch(help, -1) {
		m[g[1]] = true
	}
	return m
}

func missing(v string) bool {
	return v == "" || strings.HasPrefix(v, "[") || v == "N/A"
}

func parseNum(v string) *float64 {
	if missing(v) {
		return nil
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return nil
	}
	return &f
}

// reasonBits follows nvmlClocksEventReasons in nvml.h.
var reasonBits = []struct {
	bit uint64
	key string
}{
	{0x1, "idle"},
	{0x2, "app_clocks"},
	{0x4, "sw_power_cap"},
	{0x8, "hw_slowdown"},
	{0x10, "sync_boost"},
	{0x20, "sw_thermal"},
	{0x40, "hw_thermal"},
	{0x80, "power_brake"},
	{0x100, "display_clock"},
}

func decodeReasons(v string) []string {
	n, err := strconv.ParseUint(strings.TrimPrefix(strings.ToLower(v), "0x"), 16, 64)
	if err != nil {
		return nil
	}
	out := []string{}
	for _, r := range reasonBits {
		if n&r.bit != 0 {
			out = append(out, r.key)
		}
	}
	return out
}
