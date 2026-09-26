import { useState } from "react";
import { TerminalNav } from "@/components/terminal/TerminalNav";
import { TerminalCard, ASCIIProgressBar, TerminalOutput, ASCIISpinner } from "@/components/terminal";
import { useWallet, MINIMUM_PAYOUTS, estimatePayout, COIN_SYMBOL_TO_GECKO, type PayoutBalance, type MinerWorker } from "@/hooks/useWallet";
import { useCoinPrices, ALL_COINS } from "@/hooks/useCoinGecko";
import { formatHashrate } from "@/lib/utils";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const Wallet = () => {
  const [address, setAddress] = useState("");
  const [coin, setCoin] = useState("BTC");
  const { walletData, isLoading, error, loadWallet } = useWallet();
  const { data: coinPrices } = useCoinPrices(ALL_COINS);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadWallet(address, coin);
  };

  const handleSetPayoutCoin = async (newCoin: string) => {
    setCoin(newCoin);
    if (walletData?.minerHash) {
      try {
        await fetch(`/api/payout-coin/${encodeURIComponent(walletData.minerHash)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coin: newCoin }),
        });
        loadWallet(address, newCoin);
      } catch {
        // Silent fail - coin selector still updates locally
      }
    }
  };

  // Build a symbol -> USD price map from CoinGecko data
  const priceMap = new Map<string, number>();
  if (coinPrices) {
    for (const [symbol, geckoId] of Object.entries(COIN_SYMBOL_TO_GECKO)) {
      const found = coinPrices.find(c => c.id === geckoId);
      if (found?.current_price) {
        priceMap.set(symbol, found.current_price);
      }
    }
  }

  // Calculate estimated payout in chosen coin
  const payoutEstimate = walletData
    ? estimatePayout(
        walletData.coinBalances,
        walletData.pending,
        walletData.coin,
        priceMap,
        walletData.feeSchedule,
      )
    : null;

  const estimatedAmount = payoutEstimate?.estimatedAmount ?? 0;
  const primaryPayoutBalance: PayoutBalance | undefined = walletData?.payoutBalances.find(
    pb => pb.targetCoin === walletData.coin
  );
  const effectiveBalance = primaryPayoutBalance?.balance ?? estimatedAmount;
  const minPayout = MINIMUM_PAYOUTS[walletData?.coin ?? coin] ?? 0.1;
  const payoutProgress = minPayout > 0 ? (effectiveBalance / minPayout) * 100 : 0;

  // Convert pending earnings to payout coin amount (hide the XMR/RVN/CFX internals)
  const pendingInPayoutCoin = (() => {
    if (!walletData || !priceMap.size) return 0;
    let pendingUSD = 0;
    for (const p of walletData.pending) {
      pendingUSD += p.estimated * (priceMap.get(p.coin) ?? 0);
    }
    const payoutPrice = priceMap.get(walletData.coin) ?? 0;
    return payoutPrice > 0 ? pendingUSD / payoutPrice : 0;
  })();

  const displayCoin = walletData?.coin ?? coin;

  return (
    <div className="min-h-screen bg-background">
      <TerminalNav />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl text-primary glow-text font-bold mb-2">
            * MINING WALLET *
          </h1>
          <p className="text-muted-foreground text-sm">
            Track your {displayCoin} mining balance
          </p>
        </div>

        {/* Address Input */}
        <div className="max-w-4xl mx-auto">
          <TerminalCard title="WALLET_LOOKUP">
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-2">
                  root@pwnda:~$ enter_wallet_address
                </label>
                <div className="flex items-center gap-2 border border-border bg-muted/30 p-2">
                  <span className="text-primary">&gt;</span>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-foreground text-sm"
                    placeholder="0x... or wallet address"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-2">
                    I want to mine
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["BTC", "ETH", "XRP", "SOL", "AVAX", "DOGE", "ADA", "XMR", "ALGO", "MATIC", "HBAR", "FLR", "USDT", "RVN", "CFX"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleSetPayoutCoin(c)}
                        className={`px-3 py-1 text-xs border transition-all ${
                          coin === c
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-6 bg-primary text-primary-foreground px-6 py-2 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <ASCIISpinner /> : "LOOKUP"}
                </button>
              </div>

              {error && (
                <TerminalOutput variant="error">{error}</TerminalOutput>
              )}
            </form>
          </TerminalCard>
        </div>

        {/* Wallet Data */}
        {walletData && (
          <div className="space-y-6 max-w-4xl mx-auto">

            {/* ─── Hero Balance Card ─── */}
            <TerminalCard title={`YOUR_${walletData.coin}_BALANCE`} glowing>
              <div className="text-center py-6">
                <div className="text-4xl text-primary glow-text font-bold">
                  {effectiveBalance.toFixed(6)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {walletData.coin}
                </div>
                {walletData.pending.length > 0 && pendingInPayoutCoin > 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <span className="text-secondary glow-text-cyan text-lg">
                      +{pendingInPayoutCoin.toFixed(6)}
                    </span>
                    <span className="text-muted-foreground text-xs ml-2">
                      {walletData.coin} pending
                    </span>
                  </div>
                )}
                {walletData.pending.length === 0 && (
                  <div className="mt-4 pt-3 border-t border-border/50">
                    <span className="text-muted-foreground text-xs">
                      No pending earnings
                    </span>
                  </div>
                )}
              </div>
            </TerminalCard>

            {/* ─── Your Devices ─── */}
            {walletData.workers.length > 0 && (() => {
              const byAlgo = walletData.workers.reduce((acc, w) => {
                const key = w.algorithm;
                if (!acc[key]) acc[key] = [];
                acc[key].push(w);
                return acc;
              }, {} as Record<string, MinerWorker[]>);

              return (
                <TerminalCard title="YOUR_DEVICES">
                  <div className="space-y-4 pt-2">
                    {Object.entries(byAlgo).map(([algo, workers]) => {
                      const onlineCount = workers.filter(w => w.isOnline).length;
                      const totalHashrate = workers
                        .filter(w => w.isOnline)
                        .reduce((s, w) => s + w.hashrateHps, 0);

                      return (
                        <div key={algo}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-primary font-bold text-xs">{algo}</span>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-muted-foreground">
                                {onlineCount}/{workers.length} active
                              </span>
                              <span className="text-secondary glow-text-cyan font-bold">
                                {formatHashrate(totalHashrate)}
                              </span>
                            </div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b border-border">
                                  <th className="text-left py-1 px-2">DEVICE</th>
                                  <th className="text-left py-1 px-2">STATUS</th>
                                  <th className="text-right py-1 px-2">HASHRATE</th>
                                </tr>
                              </thead>
                              <tbody>
                                {workers.map((w, i) => (
                                  <tr key={`${w.algorithm}-${w.workerName}-${i}`} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-1 px-2 text-foreground font-mono">{w.workerName}</td>
                                    <td className="py-1 px-2">
                                      <span className={`px-2 py-0.5 text-[10px] border ${
                                        w.isOnline
                                          ? "border-green-500/50 text-green-500"
                                          : "border-destructive/50 text-destructive"
                                      }`}>
                                        {w.isOnline ? "ACTIVE" : "OFFLINE"}
                                      </span>
                                    </td>
                                    <td className="py-1 px-2 text-right text-secondary">
                                      {w.isOnline ? formatHashrate(w.hashrateHps) : "---"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TerminalCard>
              );
            })()}

            {/* ─── Payout Progress ─── */}
            <TerminalCard title="PAYOUT_PROGRESS">
              <div className="space-y-4 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {walletData.coin} Balance
                  </span>
                  <span className="text-primary">{effectiveBalance.toFixed(6)} {walletData.coin}</span>
                </div>

                <ASCIIProgressBar
                  value={Math.min(payoutProgress, 100)}
                  max={100}
                  width={50}
                  label=""
                />

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Minimum Payout</span>
                  <span className="text-secondary">{minPayout} {walletData.coin}</span>
                </div>

                {payoutProgress >= 100 && (
                  <TerminalOutput variant="success">
                    &gt; Payout threshold reached! {walletData.coin} will be sent soon.
                  </TerminalOutput>
                )}
              </div>
            </TerminalCard>

            {/* ─── Recent Payouts ─── */}
            {walletData.disbursements.length > 0 && (
              <TerminalCard title="RECENT_PAYOUTS">
                <div className="space-y-2 pt-2">
                  {walletData.disbursements.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          d.status === "confirmed" ? "bg-green-500" :
                          d.status === "failed" ? "bg-destructive" : "bg-yellow-500"
                        }`} />
                        <span className="text-muted-foreground">
                          {new Date(d.createdAt.replace(" ", "T") + "Z").toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-primary font-bold">
                        {d.amount.toFixed(6)} {d.targetCoin}
                      </span>
                    </div>
                  ))}
                  {walletData.disbursements.length > 5 && (
                    <div className="text-center text-muted-foreground text-[10px] pt-1">
                      {walletData.disbursements.length - 5} more in Advanced Details
                    </div>
                  )}
                </div>
              </TerminalCard>
            )}

            {/* ─── Advanced Details (Collapsible) ─── */}
            <TerminalCard title="ADVANCED_DETAILS">
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                  <span className="text-primary">$</span>
                  <span>Technical details and mining breakdown</span>
                </div>
                <Accordion type="multiple" className="w-full">

                  {/* Mining Breakdown */}
                  {walletData.coinBalances.length > 0 && (
                    <AccordionItem value="mining-breakdown" className="border-border">
                      <AccordionTrigger className="text-xs text-primary hover:no-underline py-2">
                        MINING_BREAKDOWN
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground border-b border-border">
                                <th className="text-left py-2 px-2">COIN</th>
                                <th className="text-right py-2 px-2">BALANCE</th>
                                <th className="text-right py-2 px-2">EARNED</th>
                                <th className="text-right py-2 px-2">FEES PAID</th>
                                <th className="text-right py-2 px-2">USD VALUE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {walletData.coinBalances.map((bal) => {
                                const usdPrice = priceMap.get(bal.coin) ?? 0;
                                return (
                                  <tr key={bal.coin} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-2 px-2 text-primary font-bold">{bal.coin}</td>
                                    <td className="py-2 px-2 text-right text-foreground">{bal.balance.toFixed(8)}</td>
                                    <td className="py-2 px-2 text-right text-muted-foreground">{bal.totalEarned.toFixed(8)}</td>
                                    <td className="py-2 px-2 text-right text-destructive">{bal.totalFeesPaid.toFixed(8)}</td>
                                    <td className="py-2 px-2 text-right text-secondary">
                                      ${(bal.balance * usdPrice).toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Active Conversions */}
                  {walletData.activeBuckets.length > 0 && (
                    <AccordionItem value="active-conversions" className="border-border">
                      <AccordionTrigger className="text-xs text-primary hover:no-underline py-2">
                        ACTIVE_CONVERSIONS
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground border-b border-border">
                                <th className="text-left py-2 px-2">PAIR</th>
                                <th className="text-right py-2 px-2">MY SHARE</th>
                                <th className="text-right py-2 px-2">BUCKET TOTAL</th>
                                <th className="text-right py-2 px-2">MY %</th>
                                <th className="text-left py-2 px-2">STATUS</th>
                                <th className="text-left py-2 px-2">CREATED</th>
                              </tr>
                            </thead>
                            <tbody>
                              {walletData.activeBuckets.map((ab) => (
                                <tr key={ab.bucketId} className="border-b border-border/50 hover:bg-muted/30">
                                  <td className="py-2 px-2 text-primary font-bold">
                                    {ab.coinMined} -&gt; {ab.targetCoin}
                                  </td>
                                  <td className="py-2 px-2 text-right text-foreground">
                                    {ab.myContribution.toFixed(8)}
                                  </td>
                                  <td className="py-2 px-2 text-right text-muted-foreground">
                                    {ab.bucketTotal.toFixed(8)}
                                  </td>
                                  <td className="py-2 px-2 text-right text-secondary">
                                    {(ab.myPct * 100).toFixed(1)}%
                                  </td>
                                  <td className="py-2 px-2">
                                    <span className={`px-2 py-0.5 text-[10px] border ${
                                      ab.status === "accumulating"
                                        ? "border-yellow-500/50 text-yellow-500"
                                        : ab.status === "completed"
                                        ? "border-green-500/50 text-green-500"
                                        : "border-primary/50 text-primary"
                                    }`}>
                                      {ab.status.toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="py-2 px-2 text-muted-foreground">
                                    {new Date(ab.createdAt.replace(" ", "T") + "Z").toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Fee Breakdown */}
                  {payoutEstimate && payoutEstimate.breakdown.length > 0 && (
                    <AccordionItem value="fee-breakdown" className="border-border">
                      <AccordionTrigger className="text-xs text-primary hover:no-underline py-2">
                        FEE_BREAKDOWN
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 text-xs">
                          {payoutEstimate.breakdown.map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="text-destructive">{item.value}</span>
                            </div>
                          ))}
                          <div className="border-t border-border pt-2 flex justify-between font-bold">
                            <span className="text-muted-foreground">You receive (est.)</span>
                            <span className="text-primary">{estimatedAmount.toFixed(8)} {walletData.coin}</span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Payout Balances */}
                  {walletData.payoutBalances.length > 0 && (
                    <AccordionItem value="payout-balances" className="border-border">
                      <AccordionTrigger className="text-xs text-primary hover:no-underline py-2">
                        PAYOUT_BALANCES
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground border-b border-border">
                                <th className="text-left py-2 px-2">TARGET COIN</th>
                                <th className="text-right py-2 px-2">BALANCE</th>
                                <th className="text-right py-2 px-2">CONVERTED</th>
                                <th className="text-right py-2 px-2">WITHDRAWN</th>
                                <th className="text-right py-2 px-2">USD VALUE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {walletData.payoutBalances.map((pb) => {
                                const usdPrice = priceMap.get(pb.targetCoin) ?? 0;
                                return (
                                  <tr key={pb.targetCoin} className="border-b border-border/50 hover:bg-muted/30">
                                    <td className="py-2 px-2 text-primary font-bold">{pb.targetCoin}</td>
                                    <td className="py-2 px-2 text-right text-foreground">{pb.balance.toFixed(8)}</td>
                                    <td className="py-2 px-2 text-right text-muted-foreground">{pb.totalConverted.toFixed(8)}</td>
                                    <td className="py-2 px-2 text-right text-muted-foreground">{pb.totalWithdrawn.toFixed(8)}</td>
                                    <td className="py-2 px-2 text-right text-secondary">
                                      ${(pb.balance * usdPrice).toFixed(2)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Earnings History */}
                  {walletData.earnings.length > 0 && (
                    <AccordionItem value="earnings-history" className="border-border">
                      <AccordionTrigger className="text-xs text-primary hover:no-underline py-2">
                        EARNINGS_HISTORY
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground border-b border-border">
                                <th className="text-left py-2 px-2">DATE</th>
                                <th className="text-left py-2 px-2">COIN</th>
                                <th className="text-right py-2 px-2">EFFORT</th>
                                <th className="text-right py-2 px-2">GROSS</th>
                                <th className="text-right py-2 px-2">FEE</th>
                                <th className="text-right py-2 px-2">NET</th>
                                <th className="text-left py-2 px-2">POOL TX</th>
                              </tr>
                            </thead>
                            <tbody>
                              {walletData.earnings.map((earning) => (
                                <tr
                                  key={earning.id}
                                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                                >
                                  <td className="py-2 px-2 text-muted-foreground">
                                    {new Date(earning.createdAt.replace(" ", "T") + "Z").toLocaleDateString()}
                                  </td>
                                  <td className="py-2 px-2 text-primary">{earning.coin}</td>
                                  <td className="py-2 px-2 text-right text-foreground">
                                    {(earning.effortPercentage * 100).toFixed(1)}%
                                  </td>
                                  <td className="py-2 px-2 text-right text-foreground">
                                    {earning.grossAmount.toFixed(8)}
                                  </td>
                                  <td className="py-2 px-2 text-right text-destructive">
                                    -{earning.serverFee.toFixed(8)}
                                  </td>
                                  <td className="py-2 px-2 text-right text-primary">
                                    {earning.netAmount.toFixed(8)}
                                  </td>
                                  <td className="py-2 px-2 text-muted-foreground font-mono">
                                    {earning.payoutTxHash.slice(0, 10)}...
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Wallet Details */}
                  <AccordionItem value="wallet-details" className="border-border">
                    <AccordionTrigger className="text-xs text-primary hover:no-underline py-2">
                      WALLET_DETAILS
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Address:</span>
                          <span className="text-foreground font-mono">
                            {walletData.address.slice(0, 12)}...{walletData.address.slice(-10)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Mining:</span>
                          <span className="text-primary">{walletData.coin}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Server Fee:</span>
                          <span className="text-foreground">5.0%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Est. Exchange Fee:</span>
                          <span className="text-foreground">~1.5%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Est. Slippage:</span>
                          <span className="text-foreground">~0.5%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Min Payout:</span>
                          <span className="text-foreground">{minPayout} {walletData.coin}</span>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                </Accordion>
              </div>
            </TerminalCard>

          </div>
        )}

        {/* Empty State */}
        {!walletData && !isLoading && (
          <div className="text-center text-muted-foreground py-12">
            <div className="text-4xl mb-4">*</div>
            <p>Enter your wallet address to view your mining balance</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Wallet;
