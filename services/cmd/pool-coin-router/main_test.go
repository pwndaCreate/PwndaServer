package main

import "testing"

// The router sits in front of the LIVE, EARNING Zephyr pool. The property that
// matters most is NOT "Zano is detected" - it is "Zephyr is never taken away".
// Every ambiguous, malformed or unknown input must fall to Zephyr, because that
// is precisely what happens today without the router in the path.
func TestClassify(t *testing.T) {
	const zanoAddr = "ZxTESTfixtureNotARealZanoAddress"
	const zephAddr = "ZEPHYRtestFixtureNotARealZephyrAddress"

	cases := []struct {
		name string
		line string
		zano bool
	}{
		// The exact line that broke on 2026-08-27, taken from the Zephyr pool's
		// own error log. This is the regression test for the whole component.
		{"real SRBMiner eth_submitLogin",
			`{"id":1,"jsonrpc":"2.0","method":"eth_submitLogin","params":["` + zanoAddr + `.zano1","x"]}`, true},
		{"eth_getWork", `{"id":2,"method":"eth_getWork","params":[]}`, true},
		{"eth_submitWork", `{"id":3,"method":"eth_submitWork","params":["0x1","0x2","0x3"]}`, true},
		{"zano address via cryptonote login object",
			`{"id":1,"method":"login","params":{"login":"` + zanoAddr + `","pass":"x"}}`, true},

		// Zephyr must keep working, in every shape it actually uses.
		{"zephyr cryptonote login",
			`{"id":1,"method":"login","params":{"login":"` + zephAddr + `","pass":"w1"}}`, false},
		{"zephyr login with fixed-diff suffix",
			`{"id":1,"method":"login","params":{"login":"` + zephAddr + `.5000","pass":"x"}}`, false},
		{"zephyr getjob", `{"id":2,"method":"getjob","params":{"id":"abc"}}`, false},
		{"zephyr submit", `{"id":3,"method":"submit","params":{"id":"a","job_id":"b","nonce":"c","result":"d"}}`, false},
		{"keepalived", `{"id":4,"method":"keepalived","params":{"id":"a"}}`, false},

		// Everything uncertain -> Zephyr.
		{"empty", ``, false},
		{"not json", `hello world`, false},
		{"truncated json", `{"id":1,"method":"eth_sub`, false},
		{"json but no method", `{"id":1,"params":{}}`, false},
		{"unknown method", `{"id":1,"method":"mining.subscribe","params":[]}`, false},
		{"legacy unmineable-style login", `{"id":1,"method":"login","params":{"login":"XMR:44abc.rig","pass":"x"}}`, false},
		{"empty params array", `{"id":1,"method":"login","params":[]}`, false},
		{"null params", `{"id":1,"method":"login","params":null}`, false},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, why := classify([]byte(c.line))
			if got != c.zano {
				t.Fatalf("classify(%s) = %v (%s), want %v", c.name, got, why, c.zano)
			}
		})
	}
}

// A Zephyr address must never be misread as Zano. "ZEPHYR..." does not start with
// "Zx", but this pins the ordering so a future edit cannot regress it.
func TestZephyrNeverClassifiedAsZano(t *testing.T) {
	for _, addr := range []string{
		"ZEPHYRtestFixtureNotARealZephyrAddress",
		"ZEPHYRxyz.worker1",
		"ZEPHYR",
	} {
		line := `{"id":1,"method":"login","params":{"login":"` + addr + `","pass":"x"}}`
		if zano, why := classify([]byte(line)); zano {
			t.Fatalf("Zephyr address %q was routed to ZANO (%s) - this would break the live pool", addr, why)
		}
	}
}

func TestExtractLogin(t *testing.T) {
	cases := []struct{ raw, want string }{
		{`{"login":"abc","pass":"x"}`, "abc"},
		{`["wallet.worker","x"]`, "wallet.worker"},
		{`[]`, ""},
		{`null`, ""},
		{`{}`, ""},
		{`"scalar"`, ""},
	}
	for _, c := range cases {
		if got := extractLogin([]byte(c.raw)); got != c.want {
			t.Errorf("extractLogin(%s) = %q, want %q", c.raw, got, c.want)
		}
	}
}

// Xelis was added 2026-09-15. These pin the same property the Zano tests pin:
// Xelis is chosen only on positive evidence, and nothing that used to reach
// Zephyr or Zano is diverted. classifyCoin wraps classify() rather than editing
// it, so the tests above still cover the live Zephyr guard unchanged.
func TestClassifyCoin(t *testing.T) {
	const zanoAddr = "ZxTESTfixtureNotARealZanoAddress"
	const zephAddr = "ZEPHYRtestFixtureNotARealZephyrAddress"
	const xelAddr = "xel:testfixturenotarealxelisaddress"

	cases := []struct{ name, line, want string }{
		// REAL first lines. A XELIS miner opens with mining.subscribe; its address only
		// comes in the second message. These are the cases that matter - the first
		// version of this rule had only the authorize case below and would have sent
		// every real XELIS miner to Zephyr. (classify(), the Zano detector, still
		// returns false for mining.subscribe - see TestClassify - which is correct: it
		// is classifyCoin that routes it to Xelis.)
		{"spec example subscribe", `{"id":1,"method":"mining.subscribe","params":["MyMiner/1.0.0",["xel/v2"]]}`, "xelis"},
		{"subscribe, current algorithm", `{"id":1,"method":"mining.subscribe","params":["SRBMiner-MULTI/2.9.0",["xel/v3"]]}`, "xelis"},
		{"subscribe, legacy algorithm name", `{"id":1,"method":"mining.subscribe","params":["SRBMiner-MULTI/2.9.0",["xel/2"]]}`, "xelis"},
		{"subscribe, several algorithms incl. xelis", `{"id":1,"method":"mining.subscribe","params":["m/1",["xel/v2","xel/v3"]]}`, "xelis"},
		{"subscribe, algorithm list omitted", `{"id":1,"method":"mining.subscribe","params":["SRBMiner-MULTI/2.9.0"]}`, "xelis"},
		// Captured 2026-09-16 from the operator's rig (it reached the Zephyr pool before go-live).
		{"real SRBMiner 3.1.1 xelishashv3 subscribe", `{"id":1,"method":"mining.subscribe","params":["SRBMiner-MULTI/3.1.1"]}`, "xelis"},
		{"subscribe, empty agent", `{"id":1,"method":"mining.subscribe","params":["",["xel/v3"]]}`, "xelis"},
		{"subscribe, no params at all", `{"id":1,"method":"mining.subscribe","params":[]}`, "xelis"},
		{"subscribe, empty algorithm list", `{"id":1,"method":"mining.subscribe","params":["m/1",[]]}`, "xelis"},
		// Captured 2026-09-16: SRBMiner 3.1.1 RECONNECTING puts a session id in the second
		// slot. Routing this to Zephyr looped the operator's rig onto the wrong pool.
		{"real SRBMiner 3.1.1 reconnect with session id", `{"id":1,"method":"mining.subscribe","params":["SRBMiner-MULTI/3.1.1","no.session.id"]}`, "xelis"},
		{"subscribe, null session id", `{"id":1,"method":"mining.subscribe","params":["m/1",null]}`, "xelis"},
		{"subscribe, object params", `{"id":1,"method":"mining.subscribe","params":{"agent":"m/1"}}`, "xelis"},
		// No other pool here accepts mining.subscribe, so it goes to Xelis whatever it offers.
		{"subscribe for another coin", `{"id":1,"method":"mining.subscribe","params":["cgminer/4.0",["sha256d"]]}`, "xelis"},
		{"subscribe with unreadable algorithms", `{"id":1,"method":"mining.subscribe","params":["m/1","xel/v3"]}`, "xelis"},

		{"xelis cryptonote-style login",
			`{"id":1,"method":"login","params":{"login":"` + xelAddr + `","pass":"x"}}`, "xelis"},
		{"xelis login with worker suffix",
			`{"id":1,"method":"login","params":{"login":"` + xelAddr + `.rig1","pass":"x"}}`, "xelis"},
		{"xelis array-form login",
			`{"id":1,"method":"mining.authorize","params":["` + xelAddr + `","x"]}`, "xelis"},

		// Regressions that must not happen.
		{"zano still zano",
			`{"id":1,"jsonrpc":"2.0","method":"eth_submitLogin","params":["` + zanoAddr + `.zano1","x"]}`, "zano"},
		{"zephyr still zephyr",
			`{"id":1,"method":"login","params":{"login":"` + zephAddr + `","pass":"w1"}}`, "zephyr"},
		{"unparseable still zephyr", `hello world`, "zephyr"},
		{"empty still zephyr", ``, "zephyr"},
		{"unknown prefix still zephyr",
			`{"id":1,"method":"login","params":{"login":"XMR:44abc.rig","pass":"x"}}`, "zephyr"},
		// "xel" without the colon is not a Xelis address and must not match.
		{"xel-without-colon is not xelis",
			`{"id":1,"method":"login","params":{"login":"xelis-not-an-address","pass":"x"}}`, "zephyr"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, label, why := classifyCoin([]byte(c.line))
			if label != c.want {
				t.Fatalf("classifyCoin(%s) = %q (%s), want %q", c.name, label, why, c.want)
			}
		})
	}
}
