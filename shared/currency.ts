export type Currency = "GBP" | "USD" | "EUR";

export interface CurrencyConfig {
  code: Currency;
  symbol: string;
  name: string;
  rate: number;
}

export const CURRENCIES: Record<Currency, CurrencyConfig> = {
  GBP: { code: "GBP", symbol: "£", name: "British Pound", rate: 1 },
  USD: { code: "USD", symbol: "$", name: "US Dollar", rate: 1.27 },
  EUR: { code: "EUR", symbol: "€", name: "Euro", rate: 1.17 },
};

export function formatPrice(amount: number, currency: Currency = "GBP"): string {
  const config = CURRENCIES[currency];
  const converted = amount * config.rate;
  return `${config.symbol}${converted.toFixed(2)}`;
}

export function convertPrice(amount: number, from: Currency, to: Currency): number {
  const inGbp = from === "GBP" ? amount : amount / CURRENCIES[from].rate;
  return to === "GBP" ? inGbp : inGbp * CURRENCIES[to].rate;
}

export function getSupportedCurrencies(): CurrencyConfig[] {
  return Object.values(CURRENCIES);
}
