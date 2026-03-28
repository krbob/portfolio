import { getActiveUiLanguage } from './i18n'
import { t } from './messages'

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
        return 'Brak kursu walutowego'
      case 'UNSUPPORTED_CORRECTIONS':
        return 'Nieobsługiwane korekty'
      case 'BOOK_ONLY':
        return 'Tylko wycena księgowa'
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
    case 'BOOK_ONLY':
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

export function labelMarketDataSnapshotType(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'QUOTE':
        return 'Kwotowanie'
      case 'PRICE_SERIES':
        return 'Seria cen'
      case 'INFLATION_MONTHLY':
        return 'Inflacja miesięczna'
      case 'INFLATION_WINDOW':
        return 'Okno inflacji'
      default:
        return value
    }
  }

  switch (value) {
    case 'QUOTE':
      return 'Quote'
    case 'PRICE_SERIES':
      return 'Price series'
    case 'INFLATION_MONTHLY':
      return 'Monthly inflation'
    case 'INFLATION_WINDOW':
      return 'Inflation window'
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

export function labelAuditCategory(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'ALL':
        return 'Wszystkie'
      case 'IMPORTS':
        return 'Import'
      case 'BACKUPS':
        return 'Kopie zapasowe'
      case 'TRANSACTIONS':
        return 'Transakcje'
      case 'ACCOUNTS':
        return 'Konta'
      case 'INSTRUMENTS':
        return 'Instrumenty'
      case 'TARGETS':
        return 'Cele'
      case 'SYSTEM':
        return 'System'
      default:
        return value
    }
  }

  switch (value) {
    case 'ALL':
      return 'All'
    case 'IMPORTS':
      return 'Imports'
    case 'BACKUPS':
      return 'Backups'
    case 'TRANSACTIONS':
      return 'Transactions'
    case 'ACCOUNTS':
      return 'Accounts'
    case 'INSTRUMENTS':
      return 'Instruments'
    case 'TARGETS':
      return 'Targets'
    case 'SYSTEM':
      return 'System'
    default:
      return value
  }
}

export function labelAuditAction(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'ACCOUNT_CREATED':
        return 'Dodano konto'
      case 'BACKUP_CREATED':
        return 'Utworzono kopię zapasową'
      case 'BACKUP_CREATE_FAILED':
        return 'Nie udało się utworzyć kopii zapasowej'
      case 'BACKUP_PRUNED':
        return 'Usunięto starą kopię zapasową'
      case 'BACKUP_RESTORED':
        return 'Przywrócono kopię zapasową'
      case 'BENCHMARK_SETTINGS_UPDATED':
        return 'Zapisano benchmarki'
      case 'INSTRUMENT_CREATED':
        return 'Dodano instrument'
      case 'MARKET_DATA_REQUEST_FAILED':
        return 'Błąd pobierania danych rynkowych'
      case 'PORTFOLIO_STATE_IMPORTED':
        return 'Zaimportowano stan portfela'
      case 'PORTFOLIO_TARGETS_REPLACED':
        return 'Zapisano alokację docelową'
      case 'READ_MODEL_CACHE_INVALIDATED':
        return 'Wyczyszczono pamięć modeli odczytowych'
      case 'READ_MODEL_REFRESH_COMPLETED':
        return 'Odświeżono modele odczytowe'
      case 'READ_MODEL_REFRESH_FAILED':
        return 'Nie udało się odświeżyć modeli odczytowych'
      case 'REBALANCING_SETTINGS_UPDATED':
        return 'Zapisano zasady rebalansowania'
      case 'TRANSACTION_BATCH_IMPORTED':
        return 'Zaimportowano paczkę transakcji'
      case 'TRANSACTION_CREATED':
        return 'Dodano transakcję'
      case 'TRANSACTION_DELETED':
        return 'Usunięto transakcję'
      case 'TRANSACTION_IMPORT_PROFILE_CREATED':
        return 'Dodano profil importu'
      case 'TRANSACTION_IMPORT_PROFILE_UPDATED':
        return 'Zaktualizowano profil importu'
      case 'TRANSACTION_IMPORT_PROFILE_DELETED':
        return 'Usunięto profil importu'
      case 'TRANSACTION_UPDATED':
        return 'Zmieniono transakcję'
      default:
        return value
    }
  }

  return value
}

export function labelReadModelInvalidationReason(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'CACHE_MISS':
        return 'Brak zapisanej migawki'
      case 'MODEL_VERSION_CHANGED':
        return 'Zmieniła się wersja modelu'
      case 'INPUT_WINDOW_CHANGED':
        return 'Zmienił się zakres danych'
      case 'CANONICAL_STATE_CHANGED':
        return 'Zmienił się stan źródłowy'
      case 'PAYLOAD_DECODE_FAILED':
        return 'Nie udało się odczytać zapisanych danych'
      case 'EXPLICIT_REFRESH':
        return 'Wymuszone odświeżenie'
      default:
        return value
    }
  }

  switch (value) {
    case 'CACHE_MISS':
      return 'Cache miss'
    case 'MODEL_VERSION_CHANGED':
      return 'Model version changed'
    case 'INPUT_WINDOW_CHANGED':
      return 'Input window changed'
    case 'CANONICAL_STATE_CHANGED':
      return 'Canonical state changed'
    case 'PAYLOAD_DECODE_FAILED':
      return 'Payload decode failed'
    case 'EXPLICIT_REFRESH':
      return 'Explicit refresh'
    default:
      return value
  }
}

export function labelImportRowStatus(value: string) {
  if (getActiveUiLanguage() === 'pl') {
    switch (value) {
      case 'IMPORTABLE':
        return 'Gotowy do importu'
      case 'DUPLICATE_EXISTING':
        return 'Duplikat istniejącej transakcji'
      case 'DUPLICATE_BATCH':
        return 'Duplikat w imporcie'
      case 'INVALID':
        return 'Nieprawidłowy'
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

export function translateBenchmarkLabel(label: string): string {
  switch (label) {
    case 'VWRA benchmark':
      return t('benchmarks.translateVwra')
    case 'Inflation benchmark':
      return t('benchmarks.translateInflation')
    case 'Configured target mix':
      return t('benchmarks.translateTargetMix')
    case 'Custom benchmark':
      return t('benchmarks.translateCustom')
    default:
      return label
  }
}
