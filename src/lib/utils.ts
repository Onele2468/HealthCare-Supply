import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  ZAR: "R", USD: "$", EUR: "€", GBP: "£", NGN: "₦", KES: "KSh", AUD: "A$", CAD: "C$",
};

/** Format a monetary amount. Defaults to South African Rand. */
export function formatCurrency(amount: number | string | null | undefined, currency = "ZAR"): string {
  const n = Number(amount ?? 0);
  const code = (currency || "ZAR").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] ?? code + " ";
  return `${symbol}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
