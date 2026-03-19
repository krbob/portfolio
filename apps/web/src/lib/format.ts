const LOCALE = 'pl-PL'

const plnFormatter = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'PLN',
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const monthFormatter = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

const numberFormatter = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 2,
})

const currencyFormatterCache = new Map<string, Intl.NumberFormat>()

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

export function formatCurrency(
  value: string | number | null | undefined,
  currency: string | null | undefined,
) {
  const amount = toNumber(value)
  if (amount == null || Number.isNaN(amount) || !currency) {
    return 'Unavailable'
  }

  return formatterForCurrency(currency).format(amount)
}

export function formatSignedCurrencyPln(value: string | number | null | undefined) {
  const amount = toNumber(value)
  if (amount == null || Number.isNaN(amount)) {
    return 'Unavailable'
  }

  const formatted = formatCurrencyPln(amount)
  return amount > 0 ? `+${formatted}` : formatted
}

export function formatNumber(
  value: string | number | null | undefined,
  options: { maximumFractionDigits?: number } = {},
) {
  const amount = toNumber(value)
  if (amount == null || Number.isNaN(amount)) {
    return 'Unavailable'
  }

  if (options.maximumFractionDigits != null) {
    return new Intl.NumberFormat(LOCALE, {
      maximumFractionDigits: options.maximumFractionDigits,
    }).format(amount)
  }

  return numberFormatter.format(amount)
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

export function formatDate(value: string | number | Date | null | undefined) {
  if (value == null || value === '') {
    return 'n/a'
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return 'n/a'
  }
  return dateFormatter.format(date)
}

export function formatYearMonth(value: string | null | undefined) {
  if (!value) {
    return 'n/a'
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    return 'n/a'
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return 'n/a'
  }

  return monthFormatter.format(new Date(Date.UTC(year, month - 1, 1)))
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

function formatterForCurrency(currency: string) {
  if (!currencyFormatterCache.has(currency)) {
    currencyFormatterCache.set(
      currency,
      new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }),
    )
  }

  return currencyFormatterCache.get(currency)!
}
