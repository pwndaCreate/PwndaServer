import { useElapsed } from "@/hooks/useElapsed";
import { coinColor } from "@/lib/coin-art";
import { CoinIcon } from "./CoinIcon";

// The MINING_RIG scene: a pickaxe strikes a CPU chip (or a GPU card on the
// Zano cycle), a coin pops out, arcs over the pickaxe and drops into the
// wallet, which then shows +1 of that coin.
//
// 12 steps x 300ms = one 3.6s loop; the coin advances XMR -> ZEPH -> ZANO once
// per loop, so a full cycle is 10.8s. The frame is derived from wall-clock
// elapsed time, never from a tick count, so a throttled background tab resumes
// on the right frame instead of drifting.
//
// Sprites are separate absolutely-positioned <pre> elements rather than one
// big pre, so each can move independently. DOM order IS the z-order: the coin
// is emitted after the pickaxe, which is what makes it arc OVER the pickaxe.

const COINS_CYCLE = ["XMR", "ZEPH", "ZANO"];
const STEP_MS = 300;
const STEPS = 12;

/** Double each pixel into two chars so cells read square in a monospace pre. */
const px = (bits: string[]) =>
  bits.map((r) => r.split("").map((c) => (c === "#" ? "##" : "  ")).join("")).join("\n");

const CPU_ART = px([
  "..#...#...#...#...#..",
  ".###################.",
  ".#.##..............#.",
  "##.................##",
  ".#....#########....#.",
  "##....#.#.#.#.#....##",
  ".#....#.......#....#.",
  "##....#.#.#.#.#....##",
  ".#....#########....#.",
  "##.................##",
  ".#.................#.",
  ".###################.",
  "..#...#...#...#...#..",
]);

const GPU_ART = px([
  "#.##########################",
  "#.#........................#",
  "#.#..####...####...####....#",
  "#.#.#....#.#....#.#....#...#",
  "#.#.#.##.#.#.##.#.#.##.#...#",
  "#.#.#....#.#....#.#....#...#",
  "#.#..####...####...####....#",
  "#.#........................#",
  "#.##########################",
  "....###...###...###.........",
]);

const WALLET_ART = px([
  "..########....########..",
  ".#....................#.",
  "#......................#",
  "#..##################..#",
  "#..#................#..#",
  "#..#................##.#",
  "#..#................##.#",
  "#..#................#..#",
  "#..##################..#",
  "#......................#",
  ".#....................#.",
  "..####################..",
]);

const PICK_UP = px([
  "......####....",
  "....########..",
  "..####....##..",
  ".##...##...##.",
  "......##......",
  ".....##.......",
  ".....##.......",
  "....##........",
  "....##........",
  "...##.........",
  "..##..........",
  "..##..........",
]);

const PICK_STRIKE = px([
  "..........##..",
  "..........##..",
  ".........##...",
  ".........##...",
  "........##....",
  ".......##.....",
  "......##......",
  ".##...##...##.",
  "..####....##..",
  "....########..",
  "......####....",
]);

// Coin flight, one entry per step. left is a % of the scene width, top is px
// from the scene top. Rises fast off the chip, apexes mid-scene, drops into
// the wallet. Steps outside this map hold the last position at opacity 0.
const PATH: Record<number, [string, number]> = {
  3: ["14%", 84],
  4: ["27%", 44],
  5: ["39%", 30],
  6: ["51%", 26],
  7: ["63%", 34],
  8: ["73%", 78],
  9: ["75%", 112],
};
const LAST: [string, number] = PATH[9];

const spriteStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: "3px",
  lineHeight: 1.1,
  color: "#e6e6e6",
  textShadow: "0 0 4px rgba(242,242,242,0.3)",
};

export function MiningRig() {
  const { elapsed, reduced } = useElapsed(100);

  // Reduced motion parks on step 10 - the "+1 received" resting frame, which
  // shows the whole story complete rather than a half-finished swing.
  const total = Math.floor(elapsed / STEP_MS);
  const step = reduced ? 10 : total % STEPS;
  const coin = reduced ? COINS_CYCLE[0] : COINS_CYCLE[Math.floor(total / STEPS) % COINS_CYCLE.length];
  const hw = coin === "ZANO" ? "GPU" : "CPU";
  const color = coinColor(coin);
  const glow = color + "66";

  const striking = step === 2;
  const pos = PATH[step] ?? LAST;
  const coinVisible = Boolean(PATH[step]);

  const status =
    step <= 3
      ? `mining ${coin} on ${hw}...`
      : step === 4
      ? "share accepted. reward found"
      : step <= 9
      ? "routing reward to your wallet..."
      : `+1 ${coin} received. keys stay local`;

  return (
    <>
      <div className="relative h-[232px] overflow-hidden" aria-hidden="true">
        {/* chip / GPU */}
        <div className="absolute bottom-6 left-[9%]">
          <div className="relative inline-block">
            <pre style={spriteStyle}>{hw === "GPU" ? GPU_ART : CPU_ART}</pre>
            {hw === "GPU" ? (
              <div className="pw-glow-text absolute -bottom-4 left-0 right-0 text-center text-[9px] font-bold text-[#f2f2f2]">
                GPU
              </div>
            ) : (
              <div className="pw-glow-text absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[#f2f2f2]">
                <span className="bg-[#121212] px-[3px]">CPU</span>
              </div>
            )}
          </div>
        </div>

        {/* pickaxe - only `bottom` tweens; the sprite swap is instant */}
        <pre
          style={{
            ...spriteStyle,
            position: "absolute",
            left: "calc(9% + 40px)",
            bottom: striking ? 88 : step === 1 ? 118 : 108,
            transition: "bottom 0.22s ease",
          }}
        >
          {striking ? PICK_STRIKE : PICK_UP}
        </pre>

        {/* sparks - one frame only, on the strike */}
        {striking && (
          <pre
            style={{
              position: "absolute",
              left: "calc(9% + 16px)",
              bottom: 96,
              margin: 0,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: "7px",
              lineHeight: 1.2,
              color: "#ffffff",
              textShadow: "0 0 8px rgba(242,242,242,0.7)",
            }}
          >
            {"\\  |  /\n *    *"}
          </pre>
        )}

        {/* coin - emitted AFTER the pickaxe so it paints over it */}
        <div
          style={{
            position: "absolute",
            width: 38,
            height: 34,
            left: pos[0],
            top: pos[1],
            opacity: coinVisible ? 1 : 0,
            // Step 3 is the pop: the coin jumps from its hidden resting spot on
            // the wallet back to the chip. Killing the left/top transition on
            // exactly this frame is what stops the cycle reset rendering as a
            // visible reverse flight.
            transition:
              step === 3
                ? "opacity 0.15s ease"
                : "left 0.3s linear, top 0.3s linear, opacity 0.3s ease",
          }}
        >
          <CoinIcon symbol={coin} cell={2.6} title="" />
        </div>

        {/* wallet */}
        <div className="absolute bottom-6 right-[9%] text-center">
          <div
            className="mb-0.5 h-4 text-[10px] font-bold"
            style={{ color, textShadow: `0 0 6px ${glow}` }}
          >
            {step >= 10 ? `+1 ${coin}` : ""}
          </div>
          <div className="relative inline-block">
            <pre style={spriteStyle}>{WALLET_ART}</pre>
            <div className="absolute inset-0 flex items-center justify-center pt-0.5">
              <div
                className="bg-[#121212] px-[3px] text-[9px] font-bold"
                style={{ color: step >= 10 ? "#f2f2f2" : "#808080" }}
              >
                {step >= 10 ? "[$$$$]" : "[____]"}
              </div>
            </div>
          </div>
          <div className="mt-1 text-[9px] tracking-[0.08em] text-[#808080]">PWNDA WALLET</div>
        </div>
      </div>

      {/* status line - the accessible description of the whole scene */}
      <div className="mt-3.5 border-t border-[#404040]/60 pt-2.5 text-[12px] text-[#808080]">
        &gt; <span style={{ color, textShadow: `0 0 6px ${glow}` }}>{status}</span>
        <span className="pw-cursor text-[#f2f2f2]" />
      </div>
    </>
  );
}
