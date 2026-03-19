import { ColorType } from 'lightweight-charts'

export const chartPalette = {
  text: '#a1a1aa',
  grid: 'rgba(255, 255, 255, 0.05)',
  border: 'rgba(255, 255, 255, 0.12)',
  crosshair: 'rgba(255, 255, 255, 0.18)',
  portfolio: '#f4f4f5',
  equities: '#60a5fa',
  bonds: '#f59e0b',
  cash: '#22d3ee',
  contributions: '#71717a',
  positiveFill: 'rgba(96, 165, 250, 0.22)',
  positiveFade: 'rgba(96, 165, 250, 0.02)',
  amberFill: 'rgba(245, 158, 11, 0.2)',
  amberFade: 'rgba(245, 158, 11, 0.03)',
  cyanFill: 'rgba(34, 211, 238, 0.18)',
  cyanFade: 'rgba(34, 211, 238, 0.03)',
} as const

export function createPortfolioChartOptions(width: number, height: number) {
  return {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: chartPalette.text,
      fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
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
    crosshair: {
      vertLine: { color: chartPalette.crosshair },
      horzLine: { color: chartPalette.grid },
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
