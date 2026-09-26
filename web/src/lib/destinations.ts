// The coins a miner can be PAID in, and why a PC cannot mine them directly.
//
// This mirrors PWNDA_INTENTS_DESTINATION_TICKERS in the wallet repo
// (src/features/swap/swap-data.ts) - the tickers NEAR Intents can deliver to an
// address the wallet derives. The two repos ship separately, so the list is
// duplicated; src/test/hero-rotation.test.ts asserts this file and its own
// mirror agree, so a drift fails the build rather than the website.
//
// THE `why` FIELD IS THE POINT OF /unmineable. Two different things get called
// "unmineable" and the honest page tells them apart:
//   pos  - no proof-of-work at all. There is nothing to mine. ETH, SOL, XRP...
//   asic - mineable, but only competitively with ASIC hardware. A desktop CPU or
//          gaming GPU cannot earn a block. BTC, LTC, DOGE...
// Either way the answer is the same: mine an ASIC-resistant coin the PC IS good
// at (ZEPH on CPU, ZANO on GPU) and take the payout in the coin you want.

export type WhyNot = "pos" | "asic";

export interface Destination {
  sym: string;
  name: string;
  why: WhyNot;
}

export const DESTINATIONS: Destination[] = [
  { sym: "BTC", name: "Bitcoin", why: "asic" },
  { sym: "ETH", name: "Ethereum", why: "pos" },
  { sym: "SOL", name: "Solana", why: "pos" },
  { sym: "LTC", name: "Litecoin", why: "asic" },
  { sym: "BCH", name: "Bitcoin Cash", why: "asic" },
  { sym: "DOGE", name: "Dogecoin", why: "asic" },
  { sym: "XRP", name: "XRP", why: "pos" },
  { sym: "TRX", name: "Tron", why: "pos" },
  { sym: "USDC", name: "USD Coin", why: "pos" },
  { sym: "USDT", name: "Tether", why: "pos" },
  { sym: "DAI", name: "Dai", why: "pos" },
  { sym: "MON", name: "Monad", why: "pos" },
  { sym: "BNB", name: "BNB", why: "pos" },
  { sym: "DASH", name: "Dash", why: "asic" },
  { sym: "XLM", name: "Stellar", why: "pos" },
  { sym: "SUI", name: "Sui", why: "pos" },
  { sym: "AVAX", name: "Avalanche", why: "pos" },
  { sym: "POL", name: "Polygon", why: "pos" },
  { sym: "ADA", name: "Cardano", why: "pos" },
];

export const WHY_LABEL: Record<WhyNot, string> = {
  pos: "not proof-of-work - there is nothing to mine",
  asic: "proof-of-work, but only ASICs can compete",
};

export function destination(sym: string): Destination | undefined {
  return DESTINATIONS.find((d) => d.sym === sym);
}
