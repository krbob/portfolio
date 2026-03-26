import { describe, expect, it } from 'vitest'
import {
  labelAccountType,
  labelAssetClass,
  labelAuditCategory,
  labelAuditOutcome,
  labelImportRowStatus,
  labelInstrumentKind,
  labelReadinessStatus,
  labelTransactionType,
  labelValuationSource,
  labelValuationStatus,
} from './labels'

describe('labelAssetClass', () => {
  it('maps all known asset classes to non-empty labels', () => {
    for (const value of ['EQUITIES', 'BONDS', 'CASH', 'FX', 'BENCHMARK']) {
      expect(labelAssetClass(value)).toBeTruthy()
      expect(labelAssetClass(value)).not.toBe('')
    }
  })

  it('returns the raw value for unknown input', () => {
    expect(labelAssetClass('UNKNOWN_CLASS')).toBe('UNKNOWN_CLASS')
  })
})

describe('labelAccountType', () => {
  it('maps all known account types', () => {
    for (const value of ['BROKERAGE', 'BOND_REGISTER', 'CASH']) {
      expect(labelAccountType(value)).toBeTruthy()
    }
  })

  it('returns raw value for unknown input', () => {
    expect(labelAccountType('CUSTOM')).toBe('CUSTOM')
  })
})

describe('labelInstrumentKind', () => {
  it('maps all known instrument kinds', () => {
    for (const value of ['ETF', 'STOCK', 'BOND_EDO', 'CASH', 'BENCHMARK_GOLD']) {
      expect(labelInstrumentKind(value)).toBeTruthy()
    }
  })

  it('returns raw value for unknown input', () => {
    expect(labelInstrumentKind('CRYPTO')).toBe('CRYPTO')
  })
})

describe('labelValuationSource', () => {
  it('maps all known valuation sources', () => {
    for (const value of ['STOCK_ANALYST', 'EDO_CALCULATOR', 'MANUAL', 'GOLD_API']) {
      expect(labelValuationSource(value)).toBeTruthy()
    }
  })

  it('returns raw value for unknown input', () => {
    expect(labelValuationSource('ORACLE')).toBe('ORACLE')
  })
})

describe('labelValuationStatus', () => {
  it('maps known statuses', () => {
    for (const value of ['VALUED', 'STALE', 'BOOK_ONLY', 'UNAVAILABLE']) {
      expect(labelValuationStatus(value)).toBeTruthy()
    }
  })

  it('returns a fallback label for null or undefined', () => {
    expect(labelValuationStatus(null)).toBeTruthy()
    expect(labelValuationStatus(undefined)).toBeTruthy()
  })
})

describe('labelReadinessStatus', () => {
  it('maps known readiness statuses', () => {
    for (const value of ['PASS', 'WARN', 'FAIL', 'INFO', 'SKIP']) {
      expect(labelReadinessStatus(value)).toBeTruthy()
    }
  })
})

describe('labelTransactionType', () => {
  it('maps all 9 transaction types', () => {
    const types = ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'REDEEM', 'FEE', 'TAX', 'INTEREST', 'CORRECTION']
    for (const type of types) {
      const label = labelTransactionType(type)
      expect(label).toBeTruthy()
      expect(label).not.toBe(type)
    }
  })

  it('returns raw value for unknown type', () => {
    expect(labelTransactionType('TRANSFER')).toBe('TRANSFER')
  })
})

describe('labelAuditOutcome', () => {
  it('maps known outcomes', () => {
    expect(labelAuditOutcome('SUCCESS')).toBeTruthy()
    expect(labelAuditOutcome('FAILURE')).toBeTruthy()
  })

  it('returns raw value for unknown outcome', () => {
    expect(labelAuditOutcome('PENDING')).toBe('PENDING')
  })
})

describe('labelAuditCategory', () => {
  it('maps known categories', () => {
    for (const category of ['ACCOUNTS', 'INSTRUMENTS', 'TRANSACTIONS', 'TARGETS', 'IMPORTS', 'BACKUPS', 'SYSTEM']) {
      expect(labelAuditCategory(category)).toBeTruthy()
    }
  })

  it('returns raw value for unknown category', () => {
    expect(labelAuditCategory('UNKNOWN')).toBe('UNKNOWN')
  })
})

describe('labelImportRowStatus', () => {
  it('maps known import row statuses', () => {
    for (const status of ['IMPORTABLE', 'DUPLICATE_EXISTING', 'DUPLICATE_BATCH', 'INVALID']) {
      expect(labelImportRowStatus(status)).toBeTruthy()
    }
  })

  it('returns raw value for unknown status', () => {
    expect(labelImportRowStatus('SKIPPED')).toBe('SKIPPED')
  })
})
