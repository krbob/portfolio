export const FIRST_SUPPORTED_EDO_SERIES_YEAR = 2000

export function edoYearOptions(existingYear?: number, currentYear = new Date().getFullYear()): string[] {
  const minYear = Math.min(FIRST_SUPPORTED_EDO_SERIES_YEAR, existingYear ?? FIRST_SUPPORTED_EDO_SERIES_YEAR)
  const maxYear = Math.max(currentYear + 2, existingYear ?? currentYear + 2)
  const years: string[] = []
  for (let year = minYear; year <= maxYear; year += 1) {
    years.push(String(year))
  }
  return years
}

export function buildEdoSeriesName(seriesMonth: string): string {
  const [yearString, monthString] = seriesMonth.split('-')
  const year = Number(yearString)
  const month = Number(monthString)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return 'EDO'
  }
  return `EDO${String(month).padStart(2, '0')}${String((year + 10) % 100).padStart(2, '0')}`
}
