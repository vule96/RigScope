//go:build !windows

package smi

import "os/exec"

func hideWindow(*exec.Cmd) {}

func tieToApp(*exec.Cmd) {}
