import { getActiveUiLanguage } from './i18n'

export function labelAssetClass(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'EQUITIES':
        return 'Akcje'
      case 'BONDS':
        return 'Obligacje'
      case 'CASH':
        return 'Gotówka'
      case 'FX':
        return 'Waluty'
      case 'BENCHMARK':
        return 'Benchmark'
      default:
        return value
    }
  }

  switch (value) {
    case 'EQUITIES':
      return 'Equities'
    case 'BONDS':
      return 'Bonds'
    case 'CASH':
      return 'Cash'
    case 'FX':
      return 'FX'
    case 'BENCHMARK':
      return 'Benchmark'
    default:
      return value
  }
}

export function labelAccountType(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'BROKERAGE':
        return 'Maklerskie'
      case 'BOND_REGISTER':
        return 'Rejestr obligacji'
      case 'CASH':
        return 'Gotówka'
      default:
        return value
    }
  }

  switch (value) {
    case 'BROKERAGE':
      return 'Brokerage'
    case 'BOND_REGISTER':
      return 'Bond register'
    case 'CASH':
      return 'Cash'
    default:
      return value
  }
}

export function labelInstrumentKind(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'ETF':
        return 'ETF'
      case 'STOCK':
        return 'Akcja'
      case 'BOND_EDO':
        return 'Obligacja EDO'
      case 'CASH':
        return 'Gotówka'
      case 'BENCHMARK_GOLD':
        return 'Benchmark złota'
      default:
        return value
    }
  }

  switch (value) {
    case 'ETF':
      return 'ETF'
    case 'STOCK':
      return 'Stock'
    case 'BOND_EDO':
      return 'EDO bond'
    case 'CASH':
      return 'Cash'
    case 'BENCHMARK_GOLD':
      return 'Gold benchmark'
    default:
      return value
  }
}

export function labelValuationSource(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'STOCK_ANALYST':
        return 'stock-analyst'
      case 'EDO_CALCULATOR':
        return 'edo-calculator'
      case 'MANUAL':
        return 'Ręcznie'
      default:
        return value
    }
  }

  switch (value) {
    case 'STOCK_ANALYST':
      return 'stock-analyst'
    case 'EDO_CALCULATOR':
      return 'edo-calculator'
    case 'MANUAL':
      return 'Manual'
    default:
      return value
  }
}

export function labelValuationStatus(value: string | null | undefined) {
  if (!value) {
    return getActiveUiLanguage() === 'pl' ? 'Brak danych' : 'Unavailable'
  }

  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'VALUED':
        return 'Wycenione'
      case 'STALE':
        return 'Opóźnione'
      case 'MISSING_MARKET_DATA':
        return 'Brak danych rynkowych'
      case 'MISSING_FX':
        return 'Brak FX'
      case 'UNSUPPORTED_CORRECTIONS':
        return 'Nieobsługiwane korekty'
      case 'BOOK_VALUE_ONLY':
        return 'Tylko wartość księgowa'
      case 'UNAVAILABLE':
        return 'Niedostępne'
      default:
        return value
    }
  }

  switch (value) {
    case 'VALUED':
      return 'Valued'
    case 'STALE':
      return 'Stale'
    case 'MISSING_MARKET_DATA':
      return 'Missing market data'
    case 'MISSING_FX':
      return 'Missing FX'
    case 'UNSUPPORTED_CORRECTIONS':
      return 'Unsupported corrections'
    case 'BOOK_VALUE_ONLY':
      return 'Book value only'
    case 'UNAVAILABLE':
      return 'Unavailable'
    default:
      return value
  }
}

export function labelReadinessStatus(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'READY':
        return 'Gotowy'
      case 'DEGRADED':
        return 'Ograniczony'
      case 'NOT_READY':
        return 'Niegotowy'
      default:
        return value
    }
  }

  switch (value) {
    case 'READY':
      return 'Ready'
    case 'DEGRADED':
      return 'Degraded'
    case 'NOT_READY':
      return 'Not ready'
    default:
      return value
  }
}

export function labelTransactionType(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'DEPOSIT':
        return 'Wpłata'
      case 'WITHDRAWAL':
        return 'Wypłata'
      case 'BUY':
        return 'Kupno'
      case 'SELL':
        return 'Sprzedaż'
      case 'REDEEM':
        return 'Wykup'
      case 'FEE':
        return 'Prowizja'
      case 'TAX':
        return 'Podatek'
      case 'INTEREST':
        return 'Odsetki'
      case 'CORRECTION':
        return 'Korekta'
      default:
        return value
    }
  }

  switch (value) {
    case 'DEPOSIT':
      return 'Deposit'
    case 'WITHDRAWAL':
      return 'Withdrawal'
    case 'BUY':
      return 'Buy'
    case 'SELL':
      return 'Sell'
    case 'REDEEM':
      return 'Redeem'
    case 'FEE':
      return 'Fee'
    case 'TAX':
      return 'Tax'
    case 'INTEREST':
      return 'Interest'
    case 'CORRECTION':
      return 'Correction'
    default:
      return value
  }
}

export function labelAuditOutcome(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'ALL':
        return 'Wszystkie'
      case 'SUCCESS':
        return 'Sukces'
      case 'FAILURE':
        return 'Błąd'
      default:
        return value
    }
  }

  switch (value) {
    case 'ALL':
      return 'All'
    case 'SUCCESS':
      return 'Success'
    case 'FAILURE':
      return 'Failure'
    default:
      return value
  }
}

export function labelImportRowStatus(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'IMPORTABLE':
        return 'Do importu'
      case 'DUPLICATE_EXISTING':
        return 'Duplikat istniejący'
      case 'DUPLICATE_BATCH':
        return 'Duplikat w paczce'
      case 'INVALID':
        return 'Błędny'
      default:
        return value
    }
  }

  switch (value) {
    case 'IMPORTABLE':
      return 'Importable'
    case 'DUPLICATE_EXISTING':
      return 'Existing duplicate'
    case 'DUPLICATE_BATCH':
      return 'Batch duplicate'
    case 'INVALID':
      return 'Invalid'
    default:
      return value
  }
}
