import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface TerminalInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  prefix?: string;
  className?: string;
  type?: string;
}

export function TerminalInput({
  value,
  onChange,
  placeholder = "",
  prefix = "> ",
  className = "",
  type = "text",
}: TerminalInputProps) {
  return (
    <div className={cn("flex items-center gap-2 font-mono", className)}>
      <span className="text-primary glow-text">{prefix}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
      />
      <span className="animate-pulse text-primary">█</span>
    </div>
  );
}

interface TerminalOutputProps {
  children: ReactNode;
  prefix?: string;
  className?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
}

export function TerminalOutput({
  children,
  prefix = "-> ",
  className = "",
  variant = "default",
}: TerminalOutputProps) {
  const variantClasses = {
    default: "text-foreground",
    success: "text-primary glow-text",
    error: "text-destructive",
    warning: "text-terminal-amber",
    info: "text-secondary glow-text-cyan",
  };

  return (
    <div className={cn("flex items-start gap-2 font-mono text-sm", className)}>
      <span className={variantClasses[variant]}>{prefix}</span>
      <span className={variantClasses[variant]}>{children}</span>
    </div>
  );
}
