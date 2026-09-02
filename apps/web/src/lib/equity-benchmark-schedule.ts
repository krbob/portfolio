export interface EquityBenchmarkScheduleDraftPhase {
  effectiveFrom: string
  symbol: string
}

export type EquityBenchmarkScheduleSymbolError = 'REQUIRED' | 'FORMAT' | null
export type EquityBenchmarkScheduleDateError = 'REQUIRED' | 'NOT_INCREASING' | null

export interface EquityBenchmarkSchedulePhaseValidation {
  symbolError: EquityBenchmarkScheduleSymbolError
  dateError: EquityBenchmarkScheduleDateError
  valid: boolean
}

const BENCHMARK_SYMBOL_PATTERN = /^[A-Z0-9._-]+$/
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function normalizeBenchmarkSymbol(value: string): string {
  return value.toUpperCase()
}

export function isValidBenchmarkSymbol(value: string): boolean {
  return BENCHMARK_SYMBOL_PATTERN.test(value.trim().toUpperCase())
}

export function validateEquityBenchmarkSchedule(
  phases: readonly EquityBenchmarkScheduleDraftPhase[],
): EquityBenchmarkSchedulePhaseValidation[] {
  return phases.map((phase, index) => {
    const symbol = phase.symbol.trim()
    const symbolError: EquityBenchmarkScheduleSymbolError = symbol.length === 0
      ? 'REQUIRED'
      : isValidBenchmarkSymbol(symbol) ? null : 'FORMAT'

    let dateError: EquityBenchmarkScheduleDateError = null
    if (index > 0) {
      if (!isValidIsoDate(phase.effectiveFrom)) {
        dateError = 'REQUIRED'
      } else if (index > 1 && phase.effectiveFrom <= phases[index - 1].effectiveFrom) {
        dateError = 'NOT_INCREASING'
      }
    }

    return {
      symbolError,
      dateError,
      valid: symbolError == null && dateError == null,
    }
  })
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}
