package smi

import (
	"reflect"
	"testing"
)

func TestBuildPicksTheFieldNameThisDriverKnows(t *testing.T) {
	supported := supportedFields(`
"utilization.gpu"
"power.draw.instant"
"clocks_throttle_reasons.active"`)
	q := build(liveColumns, supported)
	want := []string{"utilization.gpu", "power.draw.instant", "clocks_throttle_reasons.active"}
	if !reflect.DeepEqual(q.fields, want) {
		t.Fatalf("fields = %v, want %v", q.fields, want)
	}
	if len(build(liveColumns, nil).fields) != len(liveColumns) {
		t.Fatal("without help output every column should be queried")
	}
}

func TestParseLiveLine(t *testing.T) {
	q := build(liveColumns, nil)
	s, err := q.parse("87, 41, 0, [N/A], 14012, 16311, 66, 54, 171.32, 180.00, 2827, 13801, 5, 8, P2, 0x0000000000000004")
	if err != nil {
		t.Fatal(err)
	}
	if *s.GPU != 87 || s.Decoder != nil || *s.PowerW != 171.32 || s.PState != "P2" {
		t.Fatalf("unexpected sample %+v", s)
	}
	if !reflect.DeepEqual(s.Reasons, []string{"sw_power_cap"}) {
		t.Fatalf("reasons = %v", s.Reasons)
	}
	if _, err := q.parse("87, 41"); err == nil {
		t.Fatal("a short line must be an error, not a half-filled sample")
	}
}

func TestDecodeReasons(t *testing.T) {
	if got := decodeReasons("0x0000000000000061"); !reflect.DeepEqual(got, []string{"idle", "sw_thermal", "hw_thermal"}) {
		t.Fatalf("got %v", got)
	}
	if got := decodeReasons("0x0000000000000000"); len(got) != 0 || got == nil {
		t.Fatalf("no reason should be an empty list, got %#v", got)
	}
	if decodeReasons("[N/A]") != nil {
		t.Fatal("unknown should be nil")
	}
}

func TestParseCardKeepsNamesWithSpaces(t *testing.T) {
	s, err := build(cardColumns, nil).parse("NVIDIA GeForce RTX 5060 Ti, 581.57, 98.06.1F.00.9B, 16311, 180.00, 3090, 14001, 4")
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "NVIDIA GeForce RTX 5060 Ti" || *s.PCIeGenMax != 4 {
		t.Fatalf("unexpected %+v", s)
	}
}
