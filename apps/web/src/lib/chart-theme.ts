import { ColorType } from 'lightweight-charts'

type ChartAttributionRuntimeFlag = boolean | string | undefined

type ChartPalette = { [Key in keyof typeof fallbackPalette]: string }
type TokenReader = (name: string) => string

const fallbackPalette = {
  text: '#b4b6c8',
  grid: '#2a2a3e',
  border: '#3a3a4e',
  crosshair: '#3a3a4e',
  portfolio: '#3b82f6',
  performance: '#22c55e',
  equities: '#3b82f6',
  bonds: '#d97706',
  cash: '#8b8da3',
  contributions: '#b4b6c8',
  portfolioFill: 'rgba(59, 130, 246, 0.18)',
  portfolioFade: 'rgba(59, 130, 246, 0.02)',
  equityFill: 'rgba(59, 130, 246, 0.18)',
  equityFade: 'rgba(59, 130, 246, 0.02)',
  bondFill: 'rgba(217, 119, 6, 0.15)',
  bondFade: 'rgba(217, 119, 6, 0.02)',
  cashFill: 'rgba(139, 141, 163, 0.12)',
  cashFade: 'rgba(139, 141, 163, 0.02)',
  usd: '#8b5cf6',
  gold: '#d97706',
  vwra: '#b4b6c8',
  inflation: '#fbbf24',
  targetMix: '#3a3a4e',
} as const

let cachedPalette: ChartPalette | null = null

export const chartPalette = {
  get text() { return currentChartPalette().text },
  get grid() { return currentChartPalette().grid },
  get border() { return currentChartPalette().border },
  get crosshair() { return currentChartPalette().crosshair },
  get portfolio() { return currentChartPalette().portfolio },
  get performance() { return currentChartPalette().performance },
  get equities() { return currentChartPalette().equities },
  get bonds() { return currentChartPalette().bonds },
  get cash() { return currentChartPalette().cash },
  get contributions() { return currentChartPalette().contributions },
  get portfolioFill() { return currentChartPalette().portfolioFill },
  get portfolioFade() { return currentChartPalette().portfolioFade },
  get equityFill() { return currentChartPalette().equityFill },
  get equityFade() { return currentChartPalette().equityFade },
  get bondFill() { return currentChartPalette().bondFill },
  get bondFade() { return currentChartPalette().bondFade },
  get cashFill() { return currentChartPalette().cashFill },
  get cashFade() { return currentChartPalette().cashFade },
  get usd() { return currentChartPalette().usd },
  get gold() { return currentChartPalette().gold },
  get vwra() { return currentChartPalette().vwra },
  get inflation() { return currentChartPalette().inflation },
  get targetMix() { return currentChartPalette().targetMix },
}

export function resolveChartPalette(readToken: TokenReader = browserTokenReader): ChartPalette {
  const portfolio = token(readToken, '--ui-chart-series-1', fallbackPalette.portfolio)
  const equities = portfolio
  const bonds = token(readToken, '--ui-chart-series-4', fallbackPalette.bonds)
  const cash = token(readToken, '--ui-color-text-muted', fallbackPalette.cash)

  return {
    text: token(readToken, '--ui-chart-text', fallbackPalette.text),
    grid: token(readToken, '--ui-chart-grid', fallbackPalette.grid),
    border: token(readToken, '--ui-chart-scale-border', fallbackPalette.border),
    crosshair: token(readToken, '--ui-color-border-strong', fallbackPalette.crosshair),
    portfolio,
    performance: token(readToken, '--ui-chart-up', fallbackPalette.performance),
    equities,
    bonds,
    cash,
    contributions: token(readToken, '--ui-color-text-secondary', fallbackPalette.contributions),
    portfolioFill: withAlpha(portfolio, 0.18, fallbackPalette.portfolioFill),
    portfolioFade: withAlpha(portfolio, 0.02, fallbackPalette.portfolioFade),
    equityFill: withAlpha(equities, 0.18, fallbackPalette.equityFill),
    equityFade: withAlpha(equities, 0.02, fallbackPalette.equityFade),
    bondFill: withAlpha(bonds, 0.15, fallbackPalette.bondFill),
    bondFade: withAlpha(bonds, 0.02, fallbackPalette.bondFade),
    cashFill: withAlpha(cash, 0.12, fallbackPalette.cashFill),
    cashFade: withAlpha(cash, 0.02, fallbackPalette.cashFade),
    usd: token(readToken, '--ui-chart-series-5', fallbackPalette.usd),
    gold: bonds,
    vwra: token(readToken, '--ui-color-text-secondary', fallbackPalette.vwra),
    inflation: token(readToken, '--ui-color-highlight', fallbackPalette.inflation),
    targetMix: token(readToken, '--ui-color-border-strong', fallbackPalette.targetMix),
  }
}

export function resetChartPaletteCache() {
  cachedPalette = null
}

function currentChartPalette(): ChartPalette {
  cachedPalette ??= resolveChartPalette()
  return cachedPalette
}

function browserTokenReader(name: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return ''
  return window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function token(readToken: TokenReader, name: string, fallback: string): string {
  return readToken(name).trim() || fallback
}

function withAlpha(color: string, alpha: number, fallback: string): string {
  const hex = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color)
  if (hex) {
    return `rgba(${Number.parseInt(hex[1], 16)}, ${Number.parseInt(hex[2], 16)}, ${Number.parseInt(hex[3], 16)}, ${alpha})`
  }
  const rgb = /^rgb\(\s*(\d+)\s+[, ]\s*(\d+)\s+[, ]\s*(\d+)\s*\)$/i.exec(color)
  return rgb ? `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})` : fallback
}

export function createPortfolioChartOptions(width: number, height: number) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: chartPalette.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      attributionLogo: shouldShowChartAttribution(),
    },
    grid: {
      vertLines: { color: chartPalette.grid },
      horzLines: { color: chartPalette.grid },
    },
    rightPriceScale: {
      borderColor: chartPalette.border,
    },
    timeScale: {
      borderColor: chartPalette.border,
    },
    handleScroll: {
      mouseWheel: false,
      vertTouchDrag: false,
      horzTouchDrag: false,
    },
    handleScale: {
      mouseWheel: false,
      pinch: false,
      axisPressedMouseMove: false,
    },
    crosshair: {
      vertLine: { color: chartPalette.crosshair, style: 3 },
      horzLine: { color: chartPalette.crosshair, style: 3 },
    },
    width,
    height,
  }
}

export function resolveShowChartAttribution(
  runtimeValue: ChartAttributionRuntimeFlag,
  envValue: string | undefined,
): boolean {
  if (typeof runtimeValue === 'boolean') return runtimeValue
  if (typeof runtimeValue === 'string' && runtimeValue.trim() !== '') {
    return !isDisabledEnvFlag(runtimeValue)
  }

  return !isDisabledEnvFlag(envValue)
}

export function isInteractiveChartEnvironment() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  return !window.navigator.userAgent.toLowerCase().includes('jsdom')
}

function shouldShowChartAttribution(): boolean {
  const runtimeValue = typeof window === 'undefined'
    ? undefined
    : window.__PORTFOLIO_CONFIG__?.showChartAttribution

  return resolveShowChartAttribution(runtimeValue, import.meta.env.VITE_SHOW_CHART_ATTRIBUTION)
}

function isDisabledEnvFlag(value: string | undefined): boolean {
  return ['false', '0', 'no', 'off'].includes(value?.trim().toLowerCase() ?? '')
}
