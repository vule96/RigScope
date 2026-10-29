package smi

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

// Source runs nvidia-smi for GPU 0.
type Source struct {
	bin  string
	card query[Card]
	live query[Sample]
}

func Open(ctx context.Context) (*Source, error) {
	bin, err := locate()
	if err != nil {
		return nil, err
	}
	var supported map[string]bool
	if help, err := run(ctx, bin, "--help-query-gpu"); err == nil {
		supported = supportedFields(help)
	}
	return &Source{bin: bin, card: build(cardColumns, supported), live: build(liveColumns, supported)}, nil
}

func (s *Source) Card(ctx context.Context) (Card, error) {
	out, err := run(ctx, s.bin, "-i", "0", s.card.arg(), "--format=csv,noheader,nounits")
	if err != nil {
		return Card{}, err
	}
	return s.card.parse(strings.TrimSpace(strings.SplitN(out, "\n", 2)[0]))
}

// Stream keeps one nvidia-smi process printing a line per interval (cheaper than spawning one per sample)
// and restarts it if it exits. Returns when ctx is cancelled.
func (s *Source) Stream(ctx context.Context, every time.Duration, emit func(Sample), fail func(error)) {
	for ctx.Err() == nil {
		err := s.streamOnce(ctx, every, emit, fail)
		if ctx.Err() != nil {
			return
		}
		fail(fmt.Errorf("nvidia-smi dừng (%v), chạy lại sau 2 giây", err))
		select {
		case <-ctx.Done():
		case <-time.After(2 * time.Second):
		}
	}
}

func (s *Source) streamOnce(ctx context.Context, every time.Duration, emit func(Sample), fail func(error)) error {
	cmd := command(ctx, s.bin, "-i", "0", s.live.arg(), "--format=csv,noheader,nounits", "-lms", strconv.FormatInt(every.Milliseconds(), 10))
	out, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	tieToApp(cmd)
	sc := bufio.NewScanner(out)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		if sample, err := s.live.parse(line); err != nil {
			fail(err)
		} else {
			emit(sample)
		}
	}
	return cmd.Wait()
}

func locate() (string, error) {
	if p, err := exec.LookPath("nvidia-smi"); err == nil {
		return p, nil
	}
	for _, p := range []string{`C:\Windows\System32\nvidia-smi.exe`, `C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe`} {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	return "", errors.New("không tìm thấy nvidia-smi. Cài driver NVIDIA rồi mở lại app")
}

func run(ctx context.Context, bin string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	out, err := command(ctx, bin, args...).Output()
	if err != nil {
		return "", fmt.Errorf("nvidia-smi %s: %w", strings.Join(args, " "), err)
	}
	return string(out), nil
}

func command(ctx context.Context, bin string, args ...string) *exec.Cmd {
	cmd := exec.CommandContext(ctx, bin, args...)
	hideWindow(cmd)
	return cmd
}
