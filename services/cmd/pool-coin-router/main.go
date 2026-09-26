// Command pool-coin-router disambiguates two mining pools that share one TLS port
// when the miner does not send SNI.
//
// # WHY THIS EXISTS
//
// Both pools are reached through a single Pinggy tunnel on *.pwnda.org:17706 ->
// nginx :443. Phase D routes them apart with ssl_preread on the SNI hostname:
// zano.pwnda.org -> Zano :3336, everything else -> Zephyr :3333.
//
// That works only for clients that actually send an SNI extension. On 2026-08-27 a
// real SRBMiner-MULTI 3.1.1 rig proved they do not: 18 consecutive connections all
// logged sni="" at nginx, fell to the default branch, and delivered a ZANO login to
// the ZEPHYR pool, which answered:
//
//	[pool] Invalid method: eth_submitLogin (["ZxCAHCbALx...zano1","x"])
//
// The miner reported "Invalid method" / "Couldn't login" and reconnect-looped. Note
// the failure is LOUD, not silent mis-mining - the design intended that - but it is
// still a hard block on Zano mining.
//
// A second tunnel port would also solve it, but Pinggy runs one tunnel (-l 443, one
// remote port) and the two-tunnel design was deliberately dropped earlier. So the
// discriminator has to be the stratum conversation itself.
//
// # WHAT IT DOES
//
// It sits on the DEFAULT branch only (nginx :8444 terminator -> router -> pool),
// reads the miner's first stratum line, and forwards the whole connection - that
// first line included, byte for byte - to whichever pool the line belongs to.
//
// SAFETY RULE, AND IT IS THE WHOLE DESIGN: this process is in front of the LIVE,
// EARNING Zephyr pool. Every uncertain case routes to Zephyr, which is exactly what
// happens today without the router. Unparseable line, unknown method, read timeout,
// empty input - all go to Zephyr. The router can only ever ADD Zano detection; it
// cannot take Zephyr traffic away.
//
// Since 2026-09-15 it also detects Xelis (isXelisStratum), and since 2026-09-16 it
// accepts a PROXY v1 header in front of the first line (proxyproto.go): the header is
// forwarded to Xelis only (with -proxy-to-xelis), so Zephyr and Zano see the same bytes
// as before.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"io"
	"log"
	"net"
	"os"
	"os/signal"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

var (
	listenAddr = flag.String("listen", "", "address to accept miner connections on (required)")
	zanoAddr   = flag.String("zano", "", "Zano pool stratum backend (required)")
	zephyrAddr = flag.String("zephyr", "", "Zephyr pool stratum backend, also the DEFAULT route (required)")
	xelisAddr  = flag.String("xelis", "", "Xelis pool stratum backend (required)")
	firstRead  = flag.Duration("first-read-timeout", 15*time.Second, "how long to wait for the miner's first stratum line before defaulting to Zephyr")
	dialTmo    = flag.Duration("dial-timeout", 5*time.Second, "backend dial timeout")
	verbose    = flag.Bool("verbose", false, "log every routing decision")
	// Default OFF: forward only once the Xelis slave understands the header (XelisPool
	// patch 0005). A slave without it would read the header as a broken stratum line.
	proxyToXelis = flag.Bool("proxy-to-xelis", false, "forward a received PROXY v1 header to the Xelis backend")
)

var (
	nZano    atomic.Uint64
	nZephyr  atomic.Uint64
	nXelis   atomic.Uint64
	nDefault atomic.Uint64
	nProxy   atomic.Uint64
)

// classify decides which pool a first stratum line belongs to.
//
// Returns true for Zano ONLY on positive evidence. Anything else is Zephyr,
// because Zephyr is the incumbent and must behave exactly as it does today.
func classify(line []byte) (zano bool, why string) {
	var msg struct {
		Method string          `json:"method"`
		Params json.RawMessage `json:"params"`
	}
	if err := json.Unmarshal(line, &msg); err != nil {
		return false, "unparseable JSON -> default Zephyr"
	}

	// 1. Ethash-family stratum. Zephyr is RandomX and rejects these outright
	//    ("Invalid method"), so their presence is unambiguous Zano.
	switch msg.Method {
	case "eth_submitLogin", "eth_getWork", "eth_submitWork", "eth_submitHashrate":
		return true, "method " + msg.Method
	}

	// 2. Address prefix. Zano mainnet addresses start with "Zx"; Zephyr's start
	//    with "ZEPHYR". Both appear as the login, but params shape differs by
	//    method: eth_* uses a positional array, cryptonote `login` uses an object.
	login := extractLogin(msg.Params)
	if login != "" {
		// Check ZEPHYR first: it is the longer, more specific prefix, and a
		// naive "Zx" test must never be reached by a Zephyr address.
		if strings.HasPrefix(login, "ZEPHYR") {
			return false, "login is a ZEPHYR address"
		}
		if strings.HasPrefix(login, "Zx") {
			return true, "login is a Zano (Zx...) address"
		}
		return false, "unrecognised address prefix -> default Zephyr"
	}

	return false, "no method/login match -> default Zephyr"
}

// extractLogin pulls the wallet/login string out of either stratum params shape.
func extractLogin(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	// Object form: {"login": "...", "pass": "..."}  (cryptonote)
	var obj struct {
		Login string `json:"login"`
	}
	if err := json.Unmarshal(raw, &obj); err == nil && obj.Login != "" {
		return obj.Login
	}
	// Array form: ["<wallet>.<worker>", "x"]  (eth_submitLogin)
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil && len(arr) > 0 {
		return arr[0]
	}
	return ""
}

// classifyCoin picks the backend for a first stratum line.
//
// It wraps classify() rather than editing it: classify() is the tested guard in
// front of the LIVE Zephyr pool, and the same rule applies here - Xelis is chosen
// only on POSITIVE evidence, and anything uncertain still falls to Zephyr.
//
// Xelis evidence is the address prefix. XELIS addresses are bech32-style and begin
// "xel:" on mainnet (xelis_common Address; the pool's own config carries
// "AddressPrefix": "xel"), which neither a Zephyr ("ZEPHYR...") nor a Zano ("Zx...")
// address can collide with.
//
// NOT handled here, deliberately: the Xelis daemon's getwork endpoint is a
// WebSocket upgrade whose first line is an HTTP "GET /getwork/<addr>/<worker>",
// not JSON. Only stratum is exposed publicly at first; a getwork rule is a
// separate change with its own tests.
func classifyCoin(line []byte) (backend, label, why string) {
	if isZano, reason := classify(line); isZano {
		return *zanoAddr, "zano", reason
	}
	if ok, reason := isXelisStratum(line); ok {
		return *xelisAddr, "xelis", reason
	}
	return *zephyrAddr, "zephyr", "no positive match -> default Zephyr"
}

// isXelisStratum recognises a XELIS stratum session from its FIRST line.
//
// A XELIS miner opens with mining.subscribe, and its address only arrives in the
// SECOND message (mining.authorize), which the miner sends only after the server has
// answered the subscribe. So the router cannot wait for the address without
// deadlocking the miner: it has to decide on the subscribe. The first version of this
// rule matched only a xel: login, which would have sent every real XELIS miner to
// Zephyr - its test fed an authorize line as if it came first.
//
// Evidence, per the XELIS stratum spec (docs.xelis.io/developers-api/stratum):
// params are [agent, [algorithms]], the algorithm list is OPTIONAL, and names are
// xel/vN or legacy xel/N.
//   - ANY mining.subscribe                                -> Xelis. No other pool here
//     speaks stratum v1: Zephyr miners open with `login`, Zano miners with
//     eth_submitLogin, and both pools answer mining.subscribe with "Invalid method",
//     so sending a subscribe anywhere else can only fail.
//   - any line carrying a xel: login                     -> Xelis
//
// Until 2026-09-16 a subscribe whose second parameter was not a readable algorithm
// list went to Zephyr. That is exactly what SRBMiner-MULTI 3.1.1 sends when it
// RECONNECTS - ["SRBMiner-MULTI/3.1.1","no.session.id"], the stratum v1 session-id
// slot - so every Xelis rig that lost its connection was looped onto the Zephyr pool
// until it was restarted (seen live after a slave restart).
func isXelisStratum(line []byte) (bool, string) {
	var msg struct {
		Method string          `json:"method"`
		Params json.RawMessage `json:"params"`
	}
	if err := json.Unmarshal(line, &msg); err == nil && msg.Method == "mining.subscribe" {
		var params []json.RawMessage
		if json.Unmarshal(msg.Params, &params) == nil && len(params) >= 2 {
			var algos []string
			if json.Unmarshal(params[1], &algos) == nil {
				for _, a := range algos {
					if strings.HasPrefix(strings.ToLower(a), "xel/") {
						return true, "mining.subscribe offering " + a
					}
				}
			}
		}
		return true, "mining.subscribe (stratum v1 is only spoken by the Xelis pool here)"
	}
	if login := extractLoginFromLine(line); strings.HasPrefix(login, "xel:") {
		return true, "login is a Xelis (xel:...) address"
	}
	return false, ""
}

// extractLoginFromLine parses the line far enough to read a login, returning ""
// for anything unparseable - the same "uncertain means Zephyr" posture.
func extractLoginFromLine(line []byte) string {
	var msg struct {
		Method string          `json:"method"`
		Params json.RawMessage `json:"params"`
	}
	if err := json.Unmarshal(line, &msg); err != nil {
		return ""
	}
	return extractLogin(msg.Params)
}

func handle(client net.Conn) {
	defer client.Close()
	peer := client.RemoteAddr().String()

	br := bufio.NewReader(client)
	_ = client.SetReadDeadline(time.Now().Add(*firstRead))
	line, err := br.ReadBytes('\n')

	// A PROXY v1 header from nginx comes first (proxyproto.go). Consume it, remember it
	// for the Xelis pool, and read the real first stratum line after it.
	var ph *proxyHeader
	if looksLikeProxyV1(line) {
		if err != nil {
			log.Printf("%s: rejecting connection: incomplete PROXY header (%v)", peer, err)
			return
		}
		h, perr := parseProxyV1(line)
		if perr != nil {
			log.Printf("%s: rejecting connection: %v", peer, perr)
			return
		}
		ph = h
		nProxy.Add(1)
		if c := ph.Client(); c != "" {
			peer = c + " via " + peer
		}
		_ = client.SetReadDeadline(time.Now().Add(*firstRead))
		line, err = br.ReadBytes('\n')
	}
	// Clear the deadline whatever happened - from here the session is long-lived.
	_ = client.SetReadDeadline(time.Time{})

	backend, label, why := *zephyrAddr, "zephyr", ""
	switch {
	case err != nil && len(line) == 0:
		// Timed out or closed before sending anything. Nothing to classify;
		// hand it to Zephyr so behaviour matches the no-router world.
		why = "no first line (" + err.Error() + ") -> default Zephyr"
		nDefault.Add(1)
	default:
		b, l, reason := classifyCoin(line)
		backend, label, why = b, l, reason
		switch label {
		case "zano":
			nZano.Add(1)
		case "xelis":
			nXelis.Add(1)
		default:
			nZephyr.Add(1)
		}
	}
	if *verbose {
		log.Printf("%s -> %s (%s)", peer, label, why)
	}

	pool, derr := net.DialTimeout("tcp", backend, *dialTmo)
	if derr != nil {
		// Deliberately NOT falling back to the other pool: sending a Zano miner
		// to Zephyr is precisely the bug this exists to fix, and it would be
		// reported as a confusing "Invalid method" rather than a clean failure.
		log.Printf("%s: backend %s (%s) unreachable: %v", peer, backend, label, derr)
		return
	}
	defer pool.Close()

	// Replay what we consumed, then splice. Copy FROM the bufio.Reader, not the raw
	// conn - it may already hold bytes read past the first newline. The PROXY header
	// goes ONLY to Xelis, and in the same write as the first line, so the slave sees
	// it before anything else. Zephyr and Zano get exactly the bytes they always got.
	var first []byte
	if ph != nil && label == "xelis" && *proxyToXelis {
		first = append(first, ph.Raw...)
	}
	first = append(first, line...)
	if len(first) > 0 {
		if _, werr := pool.Write(first); werr != nil {
			log.Printf("%s: writing first line to %s: %v", peer, label, werr)
			return
		}
	}

	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); io.Copy(pool, br); closeWrite(pool) }()
	go func() { defer wg.Done(); io.Copy(client, pool); closeWrite(client) }()
	wg.Wait()
}

// closeWrite half-closes so the peer sees EOF instead of hanging until a timeout.
func closeWrite(c net.Conn) {
	if tc, ok := c.(*net.TCPConn); ok {
		_ = tc.CloseWrite()
	}
}

func main() {
	flag.Parse()
	for name, v := range map[string]string{"listen": *listenAddr, "zano": *zanoAddr, "zephyr": *zephyrAddr, "xelis": *xelisAddr} {
		if v == "" {
			log.Fatalf("--%s is required", name)
		}
	}
	log.SetFlags(log.LstdFlags | log.LUTC)

	ln, err := net.Listen("tcp", *listenAddr)
	if err != nil {
		log.Fatalf("listen %s: %v", *listenAddr, err)
	}
	log.Printf("pool-coin-router listening on %s", *listenAddr)
	log.Printf("  zano   -> %s (eth_* methods, or a Zx... login)", *zanoAddr)
	log.Printf("  xelis  -> %s (any mining.subscribe, or a xel:... login)", *xelisAddr)
	log.Printf("  zephyr -> %s (DEFAULT: everything else, including anything unparseable)", *zephyrAddr)
	log.Printf("  PROXY v1 headers: accepted first on every connection; forwarded to xelis=%v, never to zephyr/zano", *proxyToXelis)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		log.Printf("shutting down; routed zano=%d xelis=%d zephyr=%d nofirstline=%d proxyheaders=%d",
			nZano.Load(), nXelis.Load(), nZephyr.Load(), nDefault.Load(), nProxy.Load())
		_ = ln.Close()
		os.Exit(0)
	}()

	// Periodic counters so the journal shows the split without -verbose.
	go func() {
		for range time.Tick(10 * time.Minute) {
			log.Printf("routed so far: zano=%d xelis=%d zephyr=%d nofirstline=%d proxyheaders=%d",
				nZano.Load(), nXelis.Load(), nZephyr.Load(), nDefault.Load(), nProxy.Load())
		}
	}()

	for {
		c, aerr := ln.Accept()
		if aerr != nil {
			log.Printf("accept: %v", aerr)
			return
		}
		go handle(c)
	}
}
