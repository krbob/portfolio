import { buildStockAnalystHref, type AppLinkPreferences } from './app-links'

export function buildStockAnalystAnalysisUrl(
  baseUrl: string | null | undefined,
  symbol: string | null | undefined,
  preferences?: AppLinkPreferences,
  currentOrigin?: string,
): string | null {
  if (!symbol) return null
  return buildStockAnalystHref(baseUrl, { symbol, preferences, currentOrigin })
}
