import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatHashrate(hps: number): string {
  if (hps < 1_000) {
    return `${hps.toFixed(2)} H/s`;
  } else if (hps < 1_000_000) {
    return `${(hps / 1_000).toFixed(2)} KH/s`;
  } else if (hps < 1_000_000_000) {
    return `${(hps / 1_000_000).toFixed(2)} MH/s`;
  } else {
    return `${(hps / 1_000_000_000).toFixed(2)} GH/s`;
  }
}
