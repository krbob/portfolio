import { getActiveUiLanguage } from './i18n'
import { t, tFor, type MessageKey } from './messages'

const assetClassLabels: Record<string, MessageKey> = {
  EQUITIES: 'label.assetClassEquities',
  BONDS: 'label.assetClassBonds',
  CASH: 'label.assetClassCash',
  FX: 'label.assetClassFx',
  BENCHMARK: 'label.assetClassBenchmark',
}

const accountTypeLabels: Record<string, MessageKey> = {
  BROKERAGE: 'label.accountTypeBrokerage',
  BOND_REGISTER: 'label.accountTypeBondRegister',
  CASH: 'label.accountTypeCash',
}

const instrumentKindLabels: Record<string, MessageKey> = {
  ETF: 'label.instrumentKindEtf',
  STOCK: 'label.instrumentKindStock',
  BOND_EDO: 'label.instrumentKindBondEdo',
  CASH: 'label.instrumentKindCash',
  BENCHMARK_GOLD: 'label.instrumentKindBenchmarkGold',
}

const valuationSourceLabels: Record<string, MessageKey> = {
  STOCK_ANALYST: 'label.valuationSourceStockAnalyst',
  EDO_CALCULATOR: 'label.valuationSourceEdoCalculator',
  MANUAL: 'label.valuationSourceManual',
}

const valuationStatusLabels: Record<string, MessageKey> = {
  VALUED: 'label.valuationStatusValued',
  STALE: 'label.valuationStatusStale',
  MISSING_MARKET_DATA: 'label.valuationStatusMissingMarketData',
  MISSING_FX: 'label.valuationStatusMissingFx',
  UNSUPPORTED_CORRECTIONS: 'label.valuationStatusUnsupportedCorrections',
  BOOK_ONLY: 'label.valuationStatusBookOnly',
  UNAVAILABLE: 'label.valuationStatusUnavailable',
}

const readinessStatusLabels: Record<string, MessageKey> = {
  READY: 'label.readinessReady',
  DEGRADED: 'label.readinessDegraded',
  NOT_READY: 'label.readinessNotReady',
}

const marketDataSnapshotTypeLabels: Record<string, MessageKey> = {
  QUOTE: 'label.marketSnapshotQuote',
  PRICE_SERIES: 'label.marketSnapshotPriceSeries',
  INFLATION_MONTHLY: 'label.marketSnapshotInflationMonthly',
  INFLATION_WINDOW: 'label.marketSnapshotInflationWindow',
}

const transactionTypeLabels: Record<string, MessageKey> = {
  DEPOSIT: 'label.transactionDeposit',
  WITHDRAWAL: 'label.transactionWithdrawal',
  BUY: 'label.transactionBuy',
  SELL: 'label.transactionSell',
  REDEEM: 'label.transactionRedeem',
  FEE: 'label.transactionFee',
  TAX: 'label.transactionTax',
  INTEREST: 'label.transactionInterest',
  CORRECTION: 'label.transactionCorrection',
}

const auditOutcomeLabels: Record<string, MessageKey> = {
  ALL: 'label.auditOutcomeAll',
  SUCCESS: 'label.auditOutcomeSuccess',
  FAILURE: 'label.auditOutcomeFailure',
}

const auditCategoryLabels: Record<string, MessageKey> = {
  ALL: 'label.auditCategoryAll',
  IMPORTS: 'label.auditCategoryImports',
  BACKUPS: 'label.auditCategoryBackups',
  TRANSACTIONS: 'label.auditCategoryTransactions',
  ACCOUNTS: 'label.auditCategoryAccounts',
  INSTRUMENTS: 'label.auditCategoryInstruments',
  TARGETS: 'label.auditCategoryTargets',
  SYSTEM: 'label.auditCategorySystem',
}

const auditActionLabels: Record<string, MessageKey> = {
  ACCOUNT_CREATED: 'label.auditActionAccountCreated',
  BACKUP_CREATED: 'label.auditActionBackupCreated',
  BACKUP_CREATE_FAILED: 'label.auditActionBackupCreateFailed',
  BACKUP_PRUNED: 'label.auditActionBackupPruned',
  BACKUP_RESTORED: 'label.auditActionBackupRestored',
  ALERT_SETTINGS_UPDATED: 'label.auditActionAlertSettingsUpdated',
  BENCHMARK_SETTINGS_UPDATED: 'label.auditActionBenchmarkSettingsUpdated',
  INSTRUMENT_CREATED: 'label.auditActionInstrumentCreated',
  MARKET_DATA_REQUEST_FAILED: 'label.auditActionMarketDataRequestFailed',
  PORTFOLIO_STATE_IMPORTED: 'label.auditActionPortfolioStateImported',
  PORTFOLIO_TARGETS_REPLACED: 'label.auditActionPortfolioTargetsReplaced',
  READ_MODEL_CACHE_INVALIDATED: 'label.auditActionReadModelCacheInvalidated',
  READ_MODEL_REFRESH_COMPLETED: 'label.auditActionReadModelRefreshCompleted',
  READ_MODEL_REFRESH_FAILED: 'label.auditActionReadModelRefreshFailed',
  REBALANCING_SETTINGS_UPDATED: 'label.auditActionRebalancingSettingsUpdated',
  TRANSACTION_BATCH_IMPORTED: 'label.auditActionTransactionBatchImported',
  TRANSACTION_CREATED: 'label.auditActionTransactionCreated',
  TRANSACTION_DELETED: 'label.auditActionTransactionDeleted',
  TRANSACTION_IMPORT_PROFILE_CREATED: 'label.auditActionTransactionImportProfileCreated',
  TRANSACTION_IMPORT_PROFILE_UPDATED: 'label.auditActionTransactionImportProfileUpdated',
  TRANSACTION_IMPORT_PROFILE_DELETED: 'label.auditActionTransactionImportProfileDeleted',
  TRANSACTION_UPDATED: 'label.auditActionTransactionUpdated',
}

const readModelInvalidationReasonLabels: Record<string, MessageKey> = {
  CACHE_MISS: 'label.readModelInvalidationCacheMiss',
  MODEL_VERSION_CHANGED: 'label.readModelInvalidationModelVersionChanged',
  INPUT_WINDOW_CHANGED: 'label.readModelInvalidationInputWindowChanged',
  CANONICAL_STATE_CHANGED: 'label.readModelInvalidationCanonicalStateChanged',
  PAYLOAD_DECODE_FAILED: 'label.readModelInvalidationPayloadDecodeFailed',
  EXPLICIT_REFRESH: 'label.readModelInvalidationExplicitRefresh',
}

const importRowStatusLabels: Record<string, MessageKey> = {
  IMPORTABLE: 'label.importRowImportable',
  DUPLICATE_EXISTING: 'label.importRowDuplicateExisting',
  DUPLICATE_BATCH: 'label.importRowDuplicateBatch',
  INVALID: 'label.importRowInvalid',
}

export function labelAssetClass(value: string) {
  return labelFromMap(value, assetClassLabels)
}

export function labelAccountType(value: string) {
  return labelFromMap(value, accountTypeLabels)
}

export function labelInstrumentKind(value: string) {
  return labelFromMap(value, instrumentKindLabels)
}

export function labelValuationSource(value: string) {
  return labelFromMap(value, valuationSourceLabels)
}

export function labelValuationStatus(value: string | null | undefined) {
  return value ? labelFromMap(value, valuationStatusLabels) : t('label.valuationStatusMissingData')
}

export function labelReadinessStatus(value: string) {
  return labelFromMap(value, readinessStatusLabels)
}

export function labelMarketDataSnapshotType(value: string) {
  return labelFromMap(value, marketDataSnapshotTypeLabels)
}

export function labelTransactionType(value: string) {
  return labelFromMap(value, transactionTypeLabels)
}

export function labelAuditOutcome(value: string) {
  return labelFromMap(value, auditOutcomeLabels)
}

export function labelAuditCategory(value: string) {
  return labelFromMap(value, auditCategoryLabels)
}

export function labelAuditAction(value: string) {
  return labelFromMap(value, auditActionLabels)
}

export function labelReadModelInvalidationReason(value: string) {
  return labelFromMap(value, readModelInvalidationReasonLabels)
}

export function labelImportRowStatus(value: string) {
  return labelFromMap(value, importRowStatusLabels)
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

function labelFromMap(value: string, labels: Record<string, MessageKey>) {
  const key = labels[value]
  return key ? tFor(key, getActiveUiLanguage()) : value
}
