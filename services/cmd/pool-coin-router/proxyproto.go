package main

// PROXY protocol v1 - added 2026-09-16 so the Xelis pool sees real client addresses.
//
// The chain: Pinggy prepends a PROXY header to every tunnelled connection (the SSH
// remote command x:haproxy); nginx accepts it on its tunnel listener and keeps the real
// address (stream realip); each internal hop sends its own v1 header onward. On the
// default branch that hop is THIS router. The router consumes the header and passes it
// on ONLY to the Xelis pool, whose slave reads it (XelisPool patch 0005). Zephyr and Zano
// run cryptonote-nodejs-pool, which does not speak PROXY, so they never receive it - their
// byte stream is exactly what it was before this change.
//
// Only v1 (text) is handled: it is the only version nginx's stream proxy sends. Per the
// spec (haproxy.org proxy-protocol.txt) the line is
//   "PROXY" SP ("TCP4" | "TCP6" | "UNKNOWN") [SP src SP dst SP sport SP dport] CRLF
// at most 107 bytes, and a receiver "MUST not try to guess": a header that does not parse
// closes the connection rather than being treated as stratum.

import (
	"bytes"
	"errors"
	"net"
	"strconv"
	"strings"
)

const proxyV1MaxLen = 107

type proxyHeader struct {
	Raw     []byte // the exact line, CRLF included - forwarded verbatim
	Proto   string // TCP4, TCP6 or UNKNOWN
	SrcIP   net.IP // nil for UNKNOWN
	SrcPort int
}

// Client is the real client as "ip:port", or "" when the sender did not know it.
func (h *proxyHeader) Client() string {
	if h == nil || h.SrcIP == nil {
		return ""
	}
	return net.JoinHostPort(h.SrcIP.String(), strconv.Itoa(h.SrcPort))
}

// looksLikeProxyV1 reports whether a first line is a PROXY v1 header (well-formed or not).
// No stratum line can match: stratum lines are JSON objects.
func looksLikeProxyV1(line []byte) bool {
	return bytes.HasPrefix(line, []byte("PROXY "))
}

func parseProxyPort(s string) (int, bool) {
	if len(s) == 0 || len(s) > 5 {
		return 0, false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0, false
		}
	}
	n, err := strconv.Atoi(s)
	return n, err == nil && n <= 65535
}

func parseProxyV1(line []byte) (*proxyHeader, error) {
	if len(line) > proxyV1MaxLen {
		return nil, errors.New("PROXY header longer than 107 bytes")
	}
	if !bytes.HasSuffix(line, []byte("\r\n")) {
		return nil, errors.New("PROXY header not terminated by CRLF")
	}
	f := strings.Split(string(line[:len(line)-2]), " ")
	if len(f) < 2 || f[0] != "PROXY" {
		return nil, errors.New("not a PROXY v1 header")
	}
	h := &proxyHeader{Raw: append([]byte(nil), line...), Proto: f[1]}
	switch f[1] {
	case "UNKNOWN":
		return h, nil // the spec says the rest of the line is ignored
	case "TCP4", "TCP6":
	default:
		return nil, errors.New("PROXY header: unsupported protocol " + strconv.Quote(f[1]))
	}
	if len(f) != 6 {
		return nil, errors.New("PROXY header: want 6 fields, got " + strconv.Itoa(len(f)))
	}
	src, dst := net.ParseIP(f[2]), net.ParseIP(f[3])
	if src == nil || dst == nil {
		return nil, errors.New("PROXY header: unparseable address")
	}
	// TCP4 must carry IPv4. TCP6 may carry an IPv4-mapped address (a dual-stack sender).
	if f[1] == "TCP4" && (src.To4() == nil || dst.To4() == nil) {
		return nil, errors.New("PROXY header: TCP4 with a non-IPv4 address")
	}
	sp, ok1 := parseProxyPort(f[4])
	_, ok2 := parseProxyPort(f[5])
	if !ok1 || !ok2 {
		return nil, errors.New("PROXY header: bad port")
	}
	h.SrcIP, h.SrcPort = src, sp
	return h, nil
}
