export function isMarketValuationState(value: string | null | undefined) {
  return value === 'MARK_TO_MARKET' || value === 'STALE'
}

export function isBookOnlyValuationState(value: string | null | undefined) {
  return value === 'BOOK_ONLY'
}

export function isMarketValuedStatus(value: string | null | undefined) {
  return value === 'VALUED' || value === 'STALE'
}
