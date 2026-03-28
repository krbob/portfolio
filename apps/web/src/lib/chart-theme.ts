import { ColorType } from 'lightweight-charts'

export const chartPalette = {
  // Chrome
  text: '#a1a1aa',       // zinc-400
  grid: '#27272a',       // zinc-800
  border: '#3f3f46',     // zinc-700
  crosshair: '#52525b',  // zinc-600

  // Series
  portfolio: '#3b82f6',  // blue-500 — primary PLN area
  equities: '#3b82f6',   // blue-500
  bonds: '#f59e0b',      // amber-500
  cash: '#71717a',       // zinc-500
  contributions: '#a1a1aa', // zinc-400 dashed

  // Area fills
  portfolioFill: 'rgba(59, 130, 246, 0.18)',
  portfolioFade: 'rgba(59, 130, 246, 0.02)',
  equityFill: 'rgba(59, 130, 246, 0.18)',
  equityFade: 'rgba(59, 130, 246, 0.02)',
  bondFill: 'rgba(245, 158, 11, 0.15)',
  bondFade: 'rgba(245, 158, 11, 0.02)',
  cashFill: 'rgba(113, 113, 122, 0.12)',
  cashFade: 'rgba(113, 113, 122, 0.02)',

  // Extra series
  usd: '#8b5cf6',        // violet-500
  gold: '#d97706',       // amber-600
  vwra: '#a1a1aa',       // zinc-400
  inflation: '#f59e0b',  // amber-500
  targetMix: '#52525b',  // zinc-600
} as const

export function createPortfolioChartOptions(width: number, height: number) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: chartPalette.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
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
    },
    handleScale: {
      mouseWheel: false,
    },
    crosshair: {
      vertLine: { color: chartPalette.crosshair, style: 3 },
      horzLine: { color: chartPalette.crosshair, style: 3 },
    },
    width,
    height,
  }
}

export function isInteractiveChartEnvironment() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  return !window.navigator.userAgent.toLowerCase().includes('jsdom')
}
