import { useMemo } from "react";
import { TerminalNav } from "@/components/terminal/TerminalNav";
import { TerminalCard, ASCIIProgressBar, TerminalOutput } from "@/components/terminal";
import { useMiningStats, Worker } from "@/hooks/useMiningStats";
import { formatHashrate } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const TOP_WORKERS_LIMIT = 50;

const Dashboard = () => {
  const { stats, toggleWorkerStatus } = useMiningStats();

  const workersByHashrate = useMemo(() => {
    return [...stats.workers]
      .sort((a, b) => (b.hashrate ?? 0) - (a.hashrate ?? 0))
      .slice(0, TOP_WORKERS_LIMIT);
  }, [stats.workers]);

  const getStatusIcon = (status: Worker["status"]) => {
    switch (status) {
      case "online": return <span className="text-primary">*</span>;
      case "offline": return <span className="text-destructive">*</span>;
      case "idle": return <span className="text-terminal-amber">*</span>;
    }
  };

  const getStatusText = (status: Worker["status"]) => {
    switch (status) {
      case "online": return "ONLINE";
      case "offline": return "OFFLINE";
      case "idle": return "IDLE";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <TerminalNav />

      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl text-primary glow-text font-bold mb-2">
            # WORKER DASHBOARD #
          </h1>
          <p className="text-muted-foreground text-sm">
            Real-time monitoring of your mining workers
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
          <TerminalCard title="HASHRATE" className="hover-glow">
            <div className="text-center py-2">
              <div className="text-2xl text-primary glow-text font-bold">
                {formatHashrate(stats.totalHashrate)}
              </div>
            </div>
          </TerminalCard>

          <TerminalCard title="WORKERS" className="hover-glow">
            <div className="text-center py-2">
              <div className="text-2xl text-secondary glow-text-cyan font-bold">
                {stats.activeWorkers}/{stats.workers.length}
              </div>
              <div className="text-xs text-muted-foreground">ONLINE</div>
            </div>
          </TerminalCard>

          <TerminalCard title="ACCEPTED" className="hover-glow">
            <div className="text-center py-2">
              <div className="text-2xl text-primary glow-text font-bold">
                {stats.totalShares.accepted.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">SHARES</div>
            </div>
          </TerminalCard>

          <TerminalCard title="REJECTED" className="hover-glow">
            <div className="text-center py-2">
              <div className="text-2xl text-destructive font-bold">
                {stats.totalShares.rejected}
              </div>
              <div className="text-xs text-muted-foreground">SHARES</div>
            </div>
          </TerminalCard>
        </div>

        {/* Hashrate Chart */}
        <div className="max-w-6xl mx-auto">
          <TerminalCard title="HASHRATE_HISTORY_24H">
            <div className="h-64 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.hashrateHistory}>
                  <XAxis 
                    dataKey="time" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatHashrate(v)}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "4px",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    itemStyle={{ color: "hsl(var(--primary))" }}
                    formatter={(value: number) => [formatHashrate(value), "Hashrate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TerminalCard>
        </div>

        {/* Workers List */}
        <div className="max-w-6xl mx-auto">
          <TerminalCard title="WORKER_STATUS">
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-2">STATUS</th>
                    <th className="text-left py-2 px-2">WORKER</th>
                    <th className="text-left py-2 px-2">COIN</th>
                    <th className="text-right py-2 px-2">HASHRATE</th>
                    <th className="text-right py-2 px-2">ACCEPTED</th>
                    <th className="text-right py-2 px-2">REJECTED</th>
                    <th className="text-right py-2 px-2">LAST SEEN</th>
                    <th className="text-center py-2 px-2">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {workersByHashrate.map((worker) => (
                    <tr 
                      key={worker.id} 
                      className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-2 px-2">
                        <span className="flex items-center gap-2">
                          {getStatusIcon(worker.status)}
                          <span className={
                            worker.status === "online" ? "text-primary" : 
                            worker.status === "offline" ? "text-destructive" : 
                            "text-terminal-amber"
                          }>
                            {getStatusText(worker.status)}
                          </span>
                        </span>
                      </td>
                      <td className="py-2 px-2 text-foreground font-bold">{worker.name}</td>
                      <td className="py-2 px-2">
                        <span className={
                          worker.coin === "XMR" ? "text-terminal-amber" :
                          worker.coin === "RVN" ? "text-secondary" :
                          "text-primary"
                        }>
                          {worker.coin || " - "}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-secondary">
                        {worker.status === "online" ? formatHashrate(worker.hashrate) : " - "}
                      </td>
                      <td className="py-2 px-2 text-right text-primary">
                        {worker.shares.accepted.toLocaleString()}
                      </td>
                      <td className="py-2 px-2 text-right text-destructive">
                        {worker.shares.rejected}
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">
                        {worker.lastSeen.toLocaleTimeString()}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button
                          onClick={() => toggleWorkerStatus(worker.id)}
                          className="text-muted-foreground hover:text-primary transition-colors"
                        >
                          {worker.status === "online" ? "⏹" : ">"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TerminalCard>
        </div>

        {/* Share Efficiency */}
        <div className="max-w-6xl mx-auto">
          <TerminalCard title="EFFICIENCY">
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Share Efficiency</span>
                <span className="text-primary glow-text">
                  {((stats.totalShares.accepted / (stats.totalShares.accepted + stats.totalShares.rejected)) * 100).toFixed(2)}%
                </span>
              </div>
              <ASCIIProgressBar 
                value={stats.totalShares.accepted} 
                max={stats.totalShares.accepted + stats.totalShares.rejected}
                width={40}
                showPercentage={false}
              />
              <TerminalOutput variant="success">
                System operating within normal parameters
              </TerminalOutput>
            </div>
          </TerminalCard>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
