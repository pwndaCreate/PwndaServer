import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface TerminalCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  glowing?: boolean;
}

export function TerminalCard({ title, children, className, glowing = false }: TerminalCardProps) {
  return (
    <div
      className={cn(
        "relative bg-card border border-border p-4 font-mono",
        glowing && "animate-pulse-glow",
        className
      )}
      style={{
        boxShadow: glowing 
          ? undefined 
          : "0 0 10px hsl(var(--primary) / 0.1), inset 0 0 20px hsl(0 0% 0% / 0.5)",
      }}
    >
      {/* ASCII top border */}
      <div className="absolute -top-3 left-0 right-0 flex items-center text-xs text-muted-foreground">
        <span className="text-primary">┌</span>
        {title && (
          <>
            <span className="text-primary">─[</span>
            <span className="text-foreground bg-background px-1 glow-text">{title}</span>
            <span className="text-primary">]</span>
          </>
        )}
        <span className="flex-1 overflow-hidden text-primary">
          {"─".repeat(100)}
        </span>
        <span className="text-primary">┐</span>
      </div>

      {/* Content */}
      <div className="pt-2">{children}</div>

      {/* ASCII bottom border */}
      <div className="absolute -bottom-3 left-0 right-0 flex items-center text-xs text-primary">
        <span>└</span>
        <span className="flex-1 overflow-hidden">{"─".repeat(100)}</span>
        <span>┘</span>
      </div>
    </div>
  );
}
