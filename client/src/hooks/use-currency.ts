import { useAuth } from "./use-auth";
import { useQuery } from "@tanstack/react-query";
import { getCurrencySymbol, getCurrencyInfo } from "@/lib/currency";

export function useCurrency() {
  const { user } = useAuth();
  const code = (user as any)?.currency || "GBP";

  const { data: ratesData } = useQuery<{ base: string; rates: Record<string, number> }>({
    queryKey: ["/api/exchange-rates"],
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    enabled: code !== "GBP",
  });

  const rate = code === "GBP" ? 1 : (ratesData?.rates?.[code] ?? 1);

  const format = (amount: number | string): string => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return `${getCurrencySymbol(code)}0.00`;
    const converted = num * rate;
    const sym = getCurrencySymbol(code);
    if (code === "JPY" || code === "KRW") {
      return `${sym}${Math.round(converted).toLocaleString()}`;
    }
    return `${sym}${converted.toFixed(2)}`;
  };

  return {
    code,
    symbol: getCurrencySymbol(code),
    info: getCurrencyInfo(code),
    rate,
    format,
  };
}
