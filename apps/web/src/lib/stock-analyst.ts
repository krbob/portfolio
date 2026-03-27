export function buildStockAnalystAnalysisUrl(
  baseUrl: string | null | undefined,
  symbol: string | null | undefined,
): string | null {
  if (!baseUrl || !symbol) {
    return null
  }

  try {
    const url = new URL(baseUrl)
    url.searchParams.set('s', symbol)
    return url.toString()
  } catch {
    return null
  }
}
