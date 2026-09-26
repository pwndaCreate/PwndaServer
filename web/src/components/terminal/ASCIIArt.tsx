interface ASCIIArtProps {
  art: string;
  className?: string;
  glowing?: boolean;
}

export function ASCIIArt({ art, className = "", glowing = true }: ASCIIArtProps) {
  return (
    <pre
      className={`font-mono text-xs sm:text-sm leading-tight whitespace-pre ${
        glowing ? "glow-text" : ""
      } ${className}`}
    >
      {art}
    </pre>
  );
}

// Pre-made ASCII art for the mining platform
export const MINE_LOGO = `
██████╗ ██╗    ██╗███╗   ██╗██████╗  █████╗ 
██╔══██╗██║    ██║████╗  ██║██╔══██╗██╔══██╗
██████╔╝██║ █╗ ██║██╔██╗ ██║██║  ██║███████║
██╔═══╝ ██║███╗██║██║╚██╗██║██║  ██║██╔══██║
██║     ╚███╔███╔╝██║ ╚████║██████╔╝██║  ██║
╚═╝      ╚══╝╚══╝ ╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝`;

export const SKULL_ART = `
    ██████  
  ██      ██
 ██  ▄  ▄  ██
██    ██    ██
 ██  ▀▀▀▀  ██
  ████  ████
    ██████`;

export const PICKAXE_ART = `
    > ═══════════╗
   ╔═╝            ║
  ╔╝              ║
 ╔╝               ╚═══════════╗
╔╝                            ║
╚═════════════════════════════╝`;

export const TERMINAL_PROMPT = `root@pwnda:~$ `;

export const MINING_RIG_ART = `
┌─────────────────────────────────────┐
│  ▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓  GPU │
│  ▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓  RIG │
├─────────────────────────────────────┤
│  [█████████████████████] 100% PWR  │
│  TEMP: 65C  FAN: 80%  HASH: OK    │
└─────────────────────────────────────┘`;
