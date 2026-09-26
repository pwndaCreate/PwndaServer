import { cn } from "@/lib/utils";

interface ASCIIProgressBarProps {
  value: number;
  max?: number;
  width?: number;
  showPercentage?: boolean;
  className?: string;
  label?: string;
}

export function ASCIIProgressBar({
  value,
  max = 100,
  width = 30,
  showPercentage = true,
  className = "",
  label,
}: ASCIIProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;

  const bar = `[${"█".repeat(filled)}${"░".repeat(empty)}]`;

  return (
    <div className={cn("font-mono text-sm", className)}>
      {label && <span className="text-muted-foreground mr-2">{label}</span>}
      <span className="text-primary">{bar}</span>
      {showPercentage && (
        <span className="text-secondary ml-2 glow-text-cyan">
          {percentage.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

interface ASCIISpinnerProps {
  className?: string;
}

export function ASCIISpinner({ className = "" }: ASCIISpinnerProps) {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className={cn("text-primary glow-text", className)}>
      {frames[frame]}
    </span>
  );
}

import { useState, useEffect } from "react";
