package main

import (
	"bytes"
	"net"
	"strings"
	"testing"
	"time"
)

func TestParseProxyV1(t *testing.T) {
	good := []struct{ line, client string }{
		{"PROXY TCP4 203.0.113.7 127.0.0.1 51234 8444\r\n", "203.0.113.7:51234"},
		{"PROXY TCP6 2600:8805:5d15:a00:72ea:e7fe:cac4:e9ce 2a01:7e03::2000:40ff:fee8:db6 60586 43343\r\n",
			"[2600:8805:5d15:a00:72ea:e7fe:cac4:e9ce]:60586"}, // the header Pinggy really sent, 2026-09-16
		{"PROXY TCP6 ::ffff:203.0.113.7 ::1 1 65535\r\n", "203.0.113.7:1"}, // dual-stack sender
		{"PROXY UNKNOWN\r\n", ""},
		{"PROXY UNKNOWN anything goes here\r\n", ""},
	}
	for _, c := range good {
		h, err := parseProxyV1([]byte(c.line))
		if err != nil {
			t.Errorf("parseProxyV1(%q) failed: %v", c.line, err)
			continue
		}
		if got := h.Client(); got != c.client {
			t.Errorf("parseProxyV1(%q).Client() = %q, want %q", c.line, got, c.client)
		}
		if !bytes.Equal(h.Raw, []byte(c.line)) {
			t.Errorf("Raw must be the exact line for verbatim forwarding")
		}
	}

	bad := []string{
		"PROXY TCP4 203.0.113.7 127.0.0.1 51234 8444\n", // LF only
		"PROXY TCP4 203.0.113.7 127.0.0.1 51234\r\n",    // missing a field
		"PROXY TCP4 2600::1 127.0.0.1 1 2\r\n",          // v6 address under TCP4
		"PROXY TCP4 999.0.113.7 127.0.0.1 1 2\r\n",      // bad address
		"PROXY TCP4 203.0.113.7 127.0.0.1 65536 2\r\n",  // port out of range
		"PROXY TCP4 203.0.113.7 127.0.0.1 +1 2\r\n",     // signed port
		"PROXY TCP4 203.0.113.7 127.0.0.1 -1 2\r\n",     // negative port
		"PROXY UDP4 203.0.113.7 127.0.0.1 1 2\r\n",      // not TCP
		"PROXY  TCP4 203.0.113.7 127.0.0.1 1 2\r\n",     // double space
		"PROXY\r\n", // nothing
		"PROXY TCP4 " + strings.Repeat("1", 100) + "\r\n", // over 107 bytes
	}
	for _, line := range bad {
		if _, err := parseProxyV1([]byte(line)); err == nil {
			t.Errorf("parseProxyV1(%q) accepted a malformed header", line)
		}
	}

	if looksLikeProxyV1([]byte(`{"id":1,"method":"login"}`)) {
		t.Error("a stratum line must never look like a PROXY header")
	}
}

// fakeBackend accepts ONE connection and reports every byte it received until EOF.
// Closing the returned listener makes an undialled backend report (nil) at once.
func fakeBackend(t *testing.T) (string, <-chan []byte, net.Listener) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	got := make(chan []byte, 1)
	go func() {
		defer ln.Close()
		_ = ln.(*net.TCPListener).SetDeadline(time.Now().Add(3 * time.Second))
		c, err := ln.Accept()
		if err != nil {
			close(got) // never dialled
			return
		}
		defer c.Close()
		_ = c.SetReadDeadline(time.Now().Add(3 * time.Second))
		var all bytes.Buffer
		buf := make([]byte, 4096)
		for {
			n, rerr := c.Read(buf)
			all.Write(buf[:n])
			if rerr != nil {
				break
			}
		}
		got <- all.Bytes()
	}()
	return ln.Addr().String(), got, ln
}

// routeOnce runs handle() on one connection carrying `payload`, with fresh fake backends.
func routeOnce(t *testing.T, payload string, forward bool) (zano, zephyr, xelis []byte) {
	t.Helper()
	za, zc, zl := fakeBackend(t)
	ea, ec, el := fakeBackend(t)
	xa, xc, xl := fakeBackend(t)
	oldZ, oldE, oldX, oldF := *zanoAddr, *zephyrAddr, *xelisAddr, *proxyToXelis
	*zanoAddr, *zephyrAddr, *xelisAddr, *proxyToXelis = za, ea, xa, forward
	defer func() { *zanoAddr, *zephyrAddr, *xelisAddr, *proxyToXelis = oldZ, oldE, oldX, oldF }()

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	done := make(chan struct{})
	go func() {
		defer close(done)
		c, err := ln.Accept()
		if err == nil {
			handle(c)
		}
	}()
	cli, err := net.Dial("tcp", ln.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	_, _ = cli.Write([]byte(payload))
	_ = cli.(*net.TCPConn).CloseWrite()
	_ = cli.SetReadDeadline(time.Now().Add(4 * time.Second))
	_, _ = cli.Read(make([]byte, 64)) // wait for the router to finish the session
	cli.Close()
	<-done
	// The session is over, so any dial has happened: release the undialled backends.
	zl.Close()
	el.Close()
	xl.Close()

	take := func(c <-chan []byte) []byte {
		select {
		case b, ok := <-c:
			if !ok {
				return nil
			}
			return b
		case <-time.After(3500 * time.Millisecond):
			return nil
		}
	}
	return take(zc), take(ec), take(xc)
}

func TestHandleProxyHeader(t *testing.T) {
	const hdr = "PROXY TCP4 203.0.113.7 127.0.0.1 51234 8444\r\n"
	const xelSub = `{"id":1,"method":"mining.subscribe","params":["SRBMiner-MULTI/3.6.7",["xel/v3"]]}` + "\n"
	const zephLogin = `{"id":1,"method":"login","params":{"login":"ZEPHYRtestFixtureNotARealZephyrAddress","pass":"x"}}` + "\n"
	const zanoLogin = `{"id":1,"jsonrpc":"2.0","method":"eth_submitLogin","params":["ZxTESTfixtureNotARealZanoAddress.w","x"]}` + "\n"

	t.Run("xelis gets the header, then the first line, when forwarding is on", func(t *testing.T) {
		z, e, x := routeOnce(t, hdr+xelSub, true)
		if string(x) != hdr+xelSub {
			t.Fatalf("xelis received %q", x)
		}
		if z != nil || e != nil {
			t.Fatalf("other backends must not be dialled: zano=%q zephyr=%q", z, e)
		}
	})
	t.Run("xelis gets no header when forwarding is off", func(t *testing.T) {
		_, _, x := routeOnce(t, hdr+xelSub, false)
		if string(x) != xelSub {
			t.Fatalf("xelis received %q", x)
		}
	})
	t.Run("zephyr NEVER sees the header", func(t *testing.T) {
		z, e, x := routeOnce(t, hdr+zephLogin, true)
		if string(e) != zephLogin {
			t.Fatalf("zephyr received %q", e)
		}
		if z != nil || x != nil {
			t.Fatalf("other backends must not be dialled")
		}
	})
	t.Run("zano NEVER sees the header", func(t *testing.T) {
		z, _, _ := routeOnce(t, hdr+zanoLogin, true)
		if string(z) != zanoLogin {
			t.Fatalf("zano received %q", z)
		}
	})
	t.Run("no header: byte-for-byte as before", func(t *testing.T) {
		_, e, _ := routeOnce(t, zephLogin, true)
		if string(e) != zephLogin {
			t.Fatalf("zephyr received %q", e)
		}
		_, _, x := routeOnce(t, xelSub, true)
		if string(x) != xelSub {
			t.Fatalf("xelis received %q", x)
		}
	})
	t.Run("malformed header: connection closed, nothing dialled", func(t *testing.T) {
		z, e, x := routeOnce(t, "PROXY TCP4 999.1.1.1 127.0.0.1 1 2\r\n"+zephLogin, true)
		if z != nil || e != nil || x != nil {
			t.Fatalf("a malformed header must not reach any pool: zano=%q zephyr=%q xelis=%q", z, e, x)
		}
	})
	t.Run("header then EOF: default zephyr, header not forwarded", func(t *testing.T) {
		_, e, _ := routeOnce(t, hdr, true)
		if len(e) != 0 {
			t.Fatalf("zephyr must receive nothing (no first line), got %q", e)
		}
	})
}
