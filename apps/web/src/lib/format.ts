const LOCALE = 'pl-PL'

const plnFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 2,
})

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function toNumber(value: string | number | null | undefined) {
  if (value == null || value === '') {
    return null
  }

  return typeof value === 'number' ? value : Number(value)
}

export function formatCurrencyPln(value: string | number | null | undefined) {
  const amount = toNumber(value)
  if (amount == null || Number.isNaN(amount)) {
    return 'Unavailable'
  }

  return plnFormatter.format(amount)
}

export function formatSignedCurrencyPln(value: string | number | null | undefined) {
  const amount = toNumber(value)
  if (amount == null || Number.isNaN(amount)) {
    return 'Unavailable'
  }

  const formatted = formatCurrencyPln(amount)
  return amount > 0 ? `+${formatted}` : formatted
}

export function formatPercent(
  value: string | number | null | undefined,
  options: {
    signed?: boolean
    scale?: number
    maximumFractionDigits?: number
    suffix?: string
  } = {},
) {
  const amount = toNumber(value)
  if (amount == null || Number.isNaN(amount)) {
    return 'Unavailable'
  }

  const scaled = amount * (options.scale ?? 1)
  const digits = options.maximumFractionDigits ?? 2
  const suffix = options.suffix ?? '%'

  if (!options.signed) {
    return `${scaled.toFixed(digits)}${suffix}`
  }

  const absolute = Math.abs(scaled).toFixed(digits)
  if (scaled > 0) {
    return `+${absolute}${suffix}`
  }
  if (scaled < 0) {
    return `-${absolute}${suffix}`
  }
  return `${absolute}${suffix}`
}

export function formatDateTime(value: string | number | Date | null | undefined) {
  if (value == null || value === '') {
    return 'n/a'
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return 'n/a'
  }
  return dateTimeFormatter.format(date)
}

export function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}
