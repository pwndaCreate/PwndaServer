import { useState, useMemo } from "react";
import { TerminalNav } from "@/components/terminal/TerminalNav";
import {
  TerminalCard,
  TerminalOutput,
  ASCIISpinner,
} from "@/components/terminal";
import {
  useTopCoins,
  formatPrice,
  formatMarketCap,
  MINEABLE_COINS,
  PAYOUT_COINS,
} from "@/hooks/useCoinGecko";

const Coins = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"rank" | "price" | "change">("rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const { data: coins = [], isLoading, error, refetch } = useTopCoins(100);

  const filteredCoins = useMemo(() => {
    if (!Array.isArray(coins) || coins.length === 0) return [];
    const term = search.trim().toLowerCase();
    if (!term) return coins;
    return coins.filter(
      (coin) =>
        (coin?.name ?? "").toLowerCase().includes(term) ||
        (coin?.symbol ?? "").toLowerCase().includes(term)
    );
  }, [coins, search]);

  const sortedCoins = useMemo(() => {
    const arr = [...filteredCoins];
    return arr.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "rank":
          comparison =
            (a.market_cap_rank ?? 9999) - (b.market_cap_rank ?? 9999);
          break;
        case "price":
          comparison =
            (a.current_price ?? 0) - (b.current_price ?? 0);
          break;
        case "change":
          comparison =
            (a.price_change_percentage_24h ?? 0) -
            (b.price_change_percentage_24h ?? 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredCoins, sortBy, sortOrder]);

  const toggleSort = (column: "rank" | "price" | "change") => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const getSortIndicator = (column: "rank" | "price" | "change") => {
    if (sortBy !== column) return "-";
    return sortOrder === "asc" ? "^" : "v";
  };

  return (
    <div className="min-h-screen bg-background">
      <TerminalNav />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl text-primary glow-text font-bold mb-2">
            * SUPPORTED COINS *
          </h1>
          <p className="text-muted-foreground text-sm">
            {MINEABLE_COINS.length} mineable | {PAYOUT_COINS.length} payout
            coins | Live prices
          </p>
        </div>

        {/* Search & Controls */}
        <div className="max-w-6xl mx-auto">
          <TerminalCard title="SEARCH">
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <div className="flex-1 flex items-center gap-2 border border-border bg-muted/30 p-2">
                <span className="text-primary">&gt;</span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-foreground text-sm"
                  placeholder="Search coins... (e.g., bitcoin, eth)"
                />
              </div>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? <ASCIISpinner /> : "REFRESH"}
              </button>
            </div>
          </TerminalCard>
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-6xl mx-auto">
            <TerminalCard title="ERROR">
              <TerminalOutput variant="error">
                Failed to fetch coin data. Please try again.
              </TerminalOutput>
              <button
                onClick={() => refetch()}
                className="mt-4 bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
              >
                Retry
              </button>
            </TerminalCard>
          </div>
        )}

        {/* Coins Table */}
        <div className="max-w-6xl mx-auto">
          <TerminalCard title="COIN_LIST">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 gap-4">
                <ASCIISpinner />
                <span className="text-muted-foreground">
                  Fetching live prices...
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border">
                      <th
                        className="text-left py-2 px-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort("rank")}
                      >
                        {getSortIndicator("rank")} RANK
                      </th>
                      <th className="text-left py-2 px-2">COIN</th>
                      <th className="text-left py-2 px-2">TYPE</th>
                      <th
                        className="text-right py-2 px-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort("price")}
                      >
                        {getSortIndicator("price")} PRICE
                      </th>
                      <th
                        className="text-right py-2 px-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => toggleSort("change")}
                      >
                        {getSortIndicator("change")} 24H
                      </th>
                      <th className="text-right py-2 px-2">MARKET CAP</th>
                      <th className="text-right py-2 px-2">VOLUME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCoins.map((coin) => (
                      <tr
                        key={coin.id}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-2 text-muted-foreground">
                          #{coin.market_cap_rank ?? " - "}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            {coin.image ? (
                              <img
                                src={coin.image}
                                alt={coin.name ?? ""}
                                className="w-6 h-6 rounded-full"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                ?
                              </span>
                            )}
                            <div>
                              <div className="text-foreground font-bold uppercase">
                                {coin.symbol ?? " - "}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {coin.name ?? " - "}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-1">
                            {MINEABLE_COINS.includes(coin.id) && (
                              <span className="px-1.5 py-0.5 text-xs border border-primary/50 text-primary">
                                MINE
                              </span>
                            )}
                            {PAYOUT_COINS.includes(coin.id) && (
                              <span className="px-1.5 py-0.5 text-xs border border-secondary/50 text-secondary">
                                PAYOUT
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right text-secondary glow-text-cyan">
                          {formatPrice(coin.current_price)}
                        </td>
                        <td
                          className={`py-3 px-2 text-right ${
                            (coin.price_change_percentage_24h ?? 0) >= 0
                              ? "text-primary"
                              : "text-destructive"
                          }`}
                        >
                          {(coin.price_change_percentage_24h ?? 0) >= 0
                            ? "^"
                            : "v"}{" "}
                          {Math.abs(
                            coin.price_change_percentage_24h ?? 0
                          ).toFixed(2)}
                          %
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {formatMarketCap(coin.market_cap)}
                        </td>
                        <td className="py-3 px-2 text-right text-muted-foreground">
                          {formatMarketCap(coin.total_volume)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {sortedCoins.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {search
                      ? `No coins found matching "${search}"`
                      : "No coin data available. Please try again later."}
                  </div>
                )}
              </div>
            )}
          </TerminalCard>
        </div>

        {/* Stats */}
        {coins.length > 0 && !isLoading && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
            <TerminalCard title="TOP_GAINER">
              {(() => {
                const sorted = [...coins].sort(
                  (a, b) =>
                    (b.price_change_percentage_24h ?? -Infinity) -
                    (a.price_change_percentage_24h ?? -Infinity)
                );
                const topGainer = sorted[0];
                if (!topGainer) return <div className="pt-2 text-muted-foreground">No data</div>;
                return (
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      {topGainer.image && (
                        <img
                          src={topGainer.image}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span className="uppercase text-foreground">
                        {topGainer.symbol ?? " - "}
                      </span>
                    </div>
                    <span className="text-primary glow-text">
                      ^ {(topGainer.price_change_percentage_24h ?? 0).toFixed(2)}%
                    </span>
                  </div>
                );
              })()}
            </TerminalCard>

            <TerminalCard title="TOP_LOSER">
              {(() => {
                const sorted = [...coins].sort(
                  (a, b) =>
                    (a.price_change_percentage_24h ?? Infinity) -
                    (b.price_change_percentage_24h ?? Infinity)
                );
                const topLoser = sorted[0];
                if (!topLoser) return <div className="pt-2 text-muted-foreground">No data</div>;
                return (
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      {topLoser.image && (
                        <img
                          src={topLoser.image}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span className="uppercase text-foreground">
                        {topLoser.symbol ?? " - "}
                      </span>
                    </div>
                    <span className="text-destructive">
                      v{" "}
                      {Math.abs(topLoser.price_change_percentage_24h ?? 0).toFixed(2)}%
                    </span>
                  </div>
                );
              })()}
            </TerminalCard>

            <TerminalCard title="HIGHEST_VOLUME">
              {(() => {
                const sorted = [...coins].sort(
                  (a, b) => (b.total_volume ?? 0) - (a.total_volume ?? 0)
                );
                const highestVol = sorted[0];
                if (!highestVol) return <div className="pt-2 text-muted-foreground">No data</div>;
                return (
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      {highestVol.image && (
                        <img
                          src={highestVol.image}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span className="uppercase text-foreground">
                        {highestVol.symbol ?? " - "}
                      </span>
                    </div>
                    <span className="text-secondary glow-text-cyan">
                      {formatMarketCap(highestVol.total_volume)}
                    </span>
                  </div>
                );
              })()}
            </TerminalCard>
          </div>
        )}

        {/* API Credit */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          Price data provided by CoinGecko API | Updated every 60 seconds
        </div>
      </main>
    </div>
  );
};

export default Coins;
