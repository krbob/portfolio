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
      expect(labelAssetClass(value), `labelAssetClass('${value}')`).toBeTruthy()
    }
  })

  it('returns the raw value for unknown input', () => {
    expect(labelAssetClass('UNKNOWN_CLASS')).toBe('UNKNOWN_CLASS')
  })
})

describe('labelAccountType', () => {
  it('maps all known account types', () => {
    for (const value of ['BROKERAGE', 'BOND_REGISTER', 'CASH']) {
      expect(labelAccountType(value), `labelAccountType('${value}')`).toBeTruthy()
      expect(labelAccountType(value)).not.toBe(value)
    }
  })

  it('returns raw value for unknown input', () => {
    expect(labelAccountType('CUSTOM')).toBe('CUSTOM')
  })
})

describe('labelInstrumentKind', () => {
  it('maps all known instrument kinds', () => {
    for (const value of ['ETF', 'STOCK', 'BOND_EDO', 'CASH', 'BENCHMARK_GOLD']) {
      expect(labelInstrumentKind(value), `labelInstrumentKind('${value}')`).toBeTruthy()
    }
  })

  it('returns raw value for unknown input', () => {
    expect(labelInstrumentKind('CRYPTO')).toBe('CRYPTO')
  })
})

describe('labelValuationSource', () => {
  it('maps all known valuation sources', () => {
    for (const value of ['STOCK_ANALYST', 'EDO_CALCULATOR', 'MANUAL']) {
      expect(labelValuationSource(value), `labelValuationSource('${value}')`).toBeTruthy()
      expect(labelValuationSource(value)).not.toBe(value)
    }
  })

  it('returns raw value for unknown input', () => {
    expect(labelValuationSource('ORACLE')).toBe('ORACLE')
  })
})

describe('labelValuationStatus', () => {
  it('maps known statuses to distinct labels', () => {
    for (const value of ['VALUED', 'STALE', 'BOOK_ONLY', 'UNAVAILABLE']) {
      const label = labelValuationStatus(value)
      expect(label, `labelValuationStatus('${value}')`).toBeTruthy()
      expect(label).not.toBe(value)
    }
  })

  it('returns a fallback label for null or undefined', () => {
    expect(labelValuationStatus(null)).toBeTruthy()
    expect(labelValuationStatus(undefined)).toBeTruthy()
  })
})

describe('labelReadinessStatus', () => {
  it('maps overall readiness statuses', () => {
    for (const value of ['READY', 'DEGRADED', 'NOT_READY']) {
      const label = labelReadinessStatus(value)
      expect(label, `labelReadinessStatus('${value}')`).toBeTruthy()
      expect(label).not.toBe(value)
    }
  })

  it('returns raw value for unknown status', () => {
    expect(labelReadinessStatus('UNKNOWN_STATUS')).toBe('UNKNOWN_STATUS')
  })
})

describe('labelTransactionType', () => {
  it('maps all 9 transaction types', () => {
    const types = ['DEPOSIT', 'WITHDRAWAL', 'BUY', 'SELL', 'REDEEM', 'FEE', 'TAX', 'INTEREST', 'CORRECTION']
    for (const type of types) {
      const label = labelTransactionType(type)
      expect(label, `labelTransactionType('${type}')`).toBeTruthy()
      expect(label).not.toBe(type)
    }
  })

  it('returns raw value for unknown type', () => {
    expect(labelTransactionType('TRANSFER')).toBe('TRANSFER')
  })
})

describe('labelAuditOutcome', () => {
  it('maps known outcomes', () => {
    for (const value of ['ALL', 'SUCCESS', 'FAILURE']) {
      expect(labelAuditOutcome(value), `labelAuditOutcome('${value}')`).toBeTruthy()
    }
  })

  it('returns raw value for unknown outcome', () => {
    expect(labelAuditOutcome('PENDING')).toBe('PENDING')
  })
})

describe('labelAuditCategory', () => {
  it('maps known categories', () => {
    for (const category of ['ACCOUNTS', 'INSTRUMENTS', 'TRANSACTIONS', 'TARGETS', 'IMPORTS', 'BACKUPS', 'SYSTEM']) {
      expect(labelAuditCategory(category), `labelAuditCategory('${category}')`).toBeTruthy()
      expect(labelAuditCategory(category)).not.toBe(category)
    }
  })

  it('returns raw value for unknown category', () => {
    expect(labelAuditCategory('UNKNOWN')).toBe('UNKNOWN')
  })
})

describe('labelImportRowStatus', () => {
  it('maps known import row statuses', () => {
    for (const status of ['IMPORTABLE', 'DUPLICATE_EXISTING', 'DUPLICATE_BATCH', 'INVALID']) {
      expect(labelImportRowStatus(status), `labelImportRowStatus('${status}')`).toBeTruthy()
      expect(labelImportRowStatus(status)).not.toBe(status)
    }
  })

  it('returns raw value for unknown status', () => {
    expect(labelImportRowStatus('SKIPPED')).toBe('SKIPPED')
  })
})
