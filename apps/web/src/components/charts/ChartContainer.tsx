import { useEffect, useRef, type ReactNode } from 'react'
import { createChart, type IChartApi } from 'lightweight-charts'
import { createPortfolioChartOptions, isInteractiveChartEnvironment } from '../../lib/chart-theme'

interface ChartContainerProps {
  height?: number
  title?: string
  subtitle?: string
  legend?: ReactNode
  onChart: (chart: IChartApi) => void | (() => void)
}

export function ChartContainer({ height = 320, title, subtitle, legend, onChart }: ChartContainerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current || !isInteractiveChartEnvironment()) return

    const chart = createChart(
      containerRef.current,
      createPortfolioChartOptions(containerRef.current.clientWidth, height),
    )

    const cleanup = onChart(chart)

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      cleanup?.()
      chart.remove()
    }
  }, [height, onChart])

  return (
    <div>
      {(title || legend) && (
        <div className="mb-3 flex items-start justify-between">
          {title && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
              {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
            </div>
          )}
          {legend && <div className="flex items-center gap-4">{legend}</div>}
        </div>
      )}
      <div ref={containerRef} />
    </div>
  )
}

export function ChartLegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-zinc-400">
      <span
        className="inline-block h-0.5 w-3 rounded-full"
        style={{
          backgroundColor: color,
          ...(dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)`, backgroundColor: 'transparent' } : {}),
        }}
      />
      {label}
    </span>
  )
}
