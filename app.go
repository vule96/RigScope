package main

import (
	"context"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"rig-scope/smi"
)

const interval = time.Second

// Snapshot is what the window needs before the first sample arrives.
type Snapshot struct {
	Card       smi.Card `json:"card"`
	Error      string   `json:"error"`
	IntervalMs int64    `json:"intervalMs"`
}

type App struct {
	snapshot Snapshot
	ready    chan struct{}
	stop     context.CancelFunc
}

func NewApp() *App {
	return &App{ready: make(chan struct{}), stop: func() {}}
}

func (a *App) startup(wailsCtx context.Context) {
	defer close(a.ready)
	a.snapshot.IntervalMs = interval.Milliseconds()
	// Own context: cancelling it on shutdown kills the nvidia-smi child.
	ctx, cancel := context.WithCancel(context.Background())
	a.stop = cancel

	src, err := smi.Open(ctx)
	if err != nil {
		a.snapshot.Error = err.Error()
		return
	}
	if a.snapshot.Card, err = src.Card(ctx); err != nil {
		a.snapshot.Error = err.Error()
		return
	}
	go src.Stream(ctx, interval,
		func(s smi.Sample) { runtime.EventsEmit(wailsCtx, "sample", s) },
		func(err error) { runtime.EventsEmit(wailsCtx, "smi-error", err.Error()) },
	)
}

func (a *App) shutdown(context.Context) { a.stop() }

// Snapshot waits for startup, so the page never sees a half-filled card description.
func (a *App) Snapshot() Snapshot {
	<-a.ready
	return a.snapshot
}
