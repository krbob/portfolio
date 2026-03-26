import {
  activeNotApplicableLabel,
  activeUnavailableLabel,
} from './availability'
import { getActiveLocaleTag } from './i18n'

const currencyFormatterCache = new Map<string, Intl.NumberFormat>()
const numberFormatterCache = new Map<string, Intl.NumberFormat>()
const fixedNumberFormatterCache = new Map<string, Intl.NumberFormat>()
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>()
const monthFormatterCache = new Map<string, Intl.DateTimeFormat>()

function toNumber(value: string | number | null | undefined) {
  if (value == null || value === '') {
    return null
  }

  return typeof value === 'number' ? value : Number(value)
}

export function formatCurrencyPln(value: string | number | null | undefined) {
  const amount = toNumber(value)
  if (amount == null || Number.isNaN(amount)) {
    return activeUnavailableLabel()
  }

  return formatterForCurrency('PLN').format(amount)
}

export function formatCurrency(
  value: string | number | null | undefined,
  currency: string | null | undefined,
) {
  const amount = toNumber(value)
  if (amount == null || Number.isNaN(amount) || !currency) {
    return activeUnavailableLabel()
  }

  return formatterForCurrency(currency).format(amount)
}

export function formatCurrencyBreakdown(
  items:
    | Array<{
      currency: string
      amount: string | number | null | undefined
    }>
    | null
    | undefined,
) {
  if (!items || items.length === 0) {
    return undefined
  }

  const formatted = items
    .map((item) => formatCurrency(item.amount, item.currency))
    .filter((value) => value !== activeUnavailableLabel())

  return formatted.length > 0 ? formatted.join(' · ') : undefined
}

export function hasMeaningfulCurrencyBreakdown(
  items:
    | Array<{
      currency: string
      amount: string | number | null | undefined
    }>
    | null
    | undefined,
) {
  if (!items || items.length === 0) {
    return false
  }

  return items.length > 1 || items.some((item) => item.currency !== 'PLN')
}

export function formatSignedCurrencyPln(value: string | number | null | undefined) {
  const amount = toNumber(value)
  if (amount == null || Number.isNaN(amount)) {
    return activeUnavailableLabel()
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
    return activeUnavailableLabel()
  }

  if (options.maximumFractionDigits != null) {
    return fixedNumberFormatter(options.maximumFractionDigits).format(amount)
  }

  return numberFormatter().format(amount)
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
    return activeUnavailableLabel()
  }

  const scaled = amount * (options.scale ?? 1)
  const digits = options.maximumFractionDigits ?? 2
  const suffix = options.suffix ?? '%'
  const formatter = fixedNumberFormatter(digits)

  if (!options.signed) {
    return `${formatter.format(scaled)}${suffix}`
  }

  const absolute = formatter.format(Math.abs(scaled))
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
    return activeNotApplicableLabel()
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return activeNotApplicableLabel()
  }
  return dateTimeFormatter().format(date)
}

export function formatDate(value: string | number | Date | null | undefined) {
  if (value == null || value === '') {
    return activeNotApplicableLabel()
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.valueOf())) {
    return activeNotApplicableLabel()
  }
  return dateFormatter().format(date)
}

export function formatYearMonth(value: string | null | undefined) {
  if (!value) {
    return activeNotApplicableLabel()
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    return activeNotApplicableLabel()
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return activeNotApplicableLabel()
  }

  return monthFormatter().format(new Date(Date.UTC(year, month - 1, 1)))
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
  const cacheKey = `${getActiveLocaleTag()}::${currency}`
  if (!currencyFormatterCache.has(cacheKey)) {
    currencyFormatterCache.set(
      cacheKey,
      new Intl.NumberFormat(getActiveLocaleTag(), {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
      }),
    )
  }

  return currencyFormatterCache.get(cacheKey)!
}

function numberFormatter() {
  const locale = getActiveLocaleTag()
  if (!numberFormatterCache.has(locale)) {
    numberFormatterCache.set(
      locale,
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
      }),
    )
  }
  return numberFormatterCache.get(locale)!
}

function fixedNumberFormatter(maximumFractionDigits: number) {
  const cacheKey = `${getActiveLocaleTag()}::${maximumFractionDigits}`
  if (!fixedNumberFormatterCache.has(cacheKey)) {
    fixedNumberFormatterCache.set(
      cacheKey,
      new Intl.NumberFormat(getActiveLocaleTag(), {
        minimumFractionDigits: maximumFractionDigits,
        maximumFractionDigits,
      }),
    )
  }
  return fixedNumberFormatterCache.get(cacheKey)!
}

function dateFormatter() {
  const locale = getActiveLocaleTag()
  if (!dateFormatterCache.has(locale)) {
    dateFormatterCache.set(
      locale,
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }),
    )
  }
  return dateFormatterCache.get(locale)!
}

function dateTimeFormatter() {
  const locale = getActiveLocaleTag()
  if (!dateTimeFormatterCache.has(locale)) {
    dateTimeFormatterCache.set(
      locale,
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    )
  }
  return dateTimeFormatterCache.get(locale)!
}

function monthFormatter() {
  const locale = getActiveLocaleTag()
  if (!monthFormatterCache.has(locale)) {
    monthFormatterCache.set(
      locale,
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }),
    )
  }
  return monthFormatterCache.get(locale)!
}
