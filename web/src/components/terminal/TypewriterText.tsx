import { useState, useEffect } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
  showCursor?: boolean;
  delay?: number;
}

export function TypewriterText({
  text,
  speed = 50,
  className = "",
  onComplete,
  showCursor = true,
  delay = 0,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setHasStarted(true);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!hasStarted) return;

    if (displayedText.length < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, speed);
      return () => clearTimeout(timer);
    } else {
      setIsComplete(true);
      onComplete?.();
    }
  }, [displayedText, text, speed, onComplete, hasStarted]);

  return (
    <span className={`font-mono ${className}`}>
      {displayedText}
      {showCursor && !isComplete && (
        <span className="animate-pulse text-primary">█</span>
      )}
      {showCursor && isComplete && (
        <span className="animate-pulse text-primary opacity-50">█</span>
      )}
    </span>
  );
}
