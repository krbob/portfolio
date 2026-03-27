import {
  labelAssetClass,
  labelAuditAction,
  labelInstrumentKind,
  labelTransactionType,
  labelValuationSource,
} from './labels'
import { tFor } from './messages'
import type { UiLanguage } from './i18n'

interface AuditEventLike {
  action: string
  message: string
  metadata: Record<string, string>
  entityId?: string | null
}

export function formatAuditEventTitle(action: string, isPolish: boolean) {
  return isPolish ? labelAuditAction(action) : humanizeAuditAction(action)
}

export function formatAuditEventMessage(event: AuditEventLike, isPolish: boolean) {
  if (!isPolish) {
    return event.message
  }

  switch (event.action) {
    case 'ACCOUNT_CREATED': {
      const accountName = extractMessagePart(event.message, /^Created account (.+)\.$/)
      return accountName ? `Dodano konto ${accountName}.` : 'Dodano nowe konto.'
    }
    case 'ACCOUNT_ORDER_UPDATED':
      return 'Zmieniono kolejność wyświetlania kont.'
    case 'BACKUP_CREATED': {
      const fileName = event.entityId ?? extractMessagePart(event.message, /^Created .+ backup (.+)\.$/)
      return fileName ? `Utworzono kopię zapasową ${fileName}.` : 'Utworzono kopię zapasową.'
    }
    case 'BACKUP_CREATE_FAILED':
      return 'Nie udało się utworzyć kopii zapasowej.'
    case 'BACKUP_PRUNED': {
      const fileName = event.entityId ?? extractMessagePart(event.message, /^Pruned backup (.+) due to retention policy\.$/)
      return fileName
        ? `Usunięto starą kopię ${fileName} zgodnie z zasadami retencji.`
        : 'Usunięto starą kopię zapasową zgodnie z zasadami retencji.'
    }
    case 'BACKUP_RESTORED': {
      const fileName = event.entityId ?? extractMessagePart(event.message, /^Restored backup (.+) in .+ mode\.$/)
      const mode = event.metadata.mode ?? extractMessagePart(event.message, /^Restored backup .+ in ([A-Z_]+) mode\.$/)
      return fileName && mode
        ? `Przywrócono kopię ${fileName} w trybie ${mode}.`
        : fileName
          ? `Przywrócono kopię ${fileName}.`
          : 'Przywrócono kopię zapasową.'
    }
    case 'BENCHMARK_SETTINGS_UPDATED':
      return 'Zapisano konfigurację benchmarków.'
    case 'INSTRUMENT_CREATED': {
      const instrumentName = extractMessagePart(event.message, /^Created instrument (.+)\.$/)
      return instrumentName ? `Dodano instrument ${instrumentName}.` : 'Dodano nowy instrument.'
    }
    case 'MARKET_DATA_REQUEST_FAILED': {
      const symbol = event.metadata.symbol ?? event.metadata.instrumentName
      const upstream = event.metadata.upstream ? labelUpstream(event.metadata.upstream) : null
      if (symbol && upstream) {
        return `Nie udało się pobrać danych rynkowych z ${upstream} dla ${symbol}.`
      }
      if (symbol) {
        return `Nie udało się pobrać danych rynkowych dla ${symbol}.`
      }
      if (upstream) {
        return `Nie udało się pobrać danych rynkowych z ${upstream}.`
      }
      return 'Nie udało się pobrać danych rynkowych.'
    }
    case 'PORTFOLIO_STATE_IMPORTED': {
      const mode = event.metadata.mode
      return mode ? `Zaimportowano stan portfela w trybie ${mode}.` : 'Zaimportowano stan portfela.'
    }
    case 'READ_MODEL_CACHE_INVALIDATED':
      return 'Wyczyszczono pamięć modeli odczytowych.'
    case 'READ_MODEL_REFRESH_COMPLETED':
      return 'Odświeżono historię i zwroty portfela w pamięci podręcznej.'
    case 'READ_MODEL_REFRESH_FAILED':
      return 'Nie udało się odświeżyć modeli odczytowych.'
    case 'REBALANCING_SETTINGS_UPDATED':
      return 'Zapisano zasady rebalansowania.'
    case 'TRANSACTION_BATCH_IMPORTED': {
      const createdCount = event.metadata.createdCount
      const source = formatAuditSource(event.metadata)
      if (createdCount && source) {
        return `Zaimportowano ${createdCount} transakcji z ${source}.`
      }
      if (createdCount) {
        return `Zaimportowano ${createdCount} transakcji.`
      }
      return 'Zaimportowano paczkę transakcji.'
    }
    case 'TRANSACTION_CREATED': {
      const type = labelTransactionKind(event)
      return type ? `Dodano transakcję: ${type}.` : 'Dodano transakcję.'
    }
    case 'TRANSACTION_UPDATED': {
      const type = labelTransactionKind(event)
      return type ? `Zmieniono transakcję: ${type}.` : 'Zmieniono transakcję.'
    }
    case 'TRANSACTION_DELETED':
      return 'Usunięto transakcję.'
    case 'TRANSACTION_IMPORT_PROFILE_CREATED': {
      const profileName = event.metadata.name
      return profileName ? `Dodano profil importu ${profileName}.` : 'Dodano profil importu.'
    }
    case 'TRANSACTION_IMPORT_PROFILE_UPDATED': {
      const profileName = event.metadata.name
      return profileName ? `Zaktualizowano profil importu ${profileName}.` : 'Zaktualizowano profil importu.'
    }
    case 'TRANSACTION_IMPORT_PROFILE_DELETED':
      return 'Usunięto profil importu.'
    default:
      return event.message
  }
}

export function buildAuditMetadataSummary(metadata: Record<string, string>, isPolish: boolean) {
  const lang = toLanguage(isPolish)
  const parts: string[] = []

  const source = formatAuditSource(metadata)
  if (source) {
    parts.push(source)
  }

  if (metadata.mode) {
    parts.push(`${tFor('auditCopy.modePrefix', lang)} ${metadata.mode}`)
  }

  if (metadata.trigger) {
    parts.push(`${tFor('auditCopy.triggerPrefix', lang)} ${labelAuditTrigger(metadata.trigger)}`)
  }

  if (metadata.profileName) {
    parts.push(`${tFor('auditCopy.profilePrefix', lang)} ${metadata.profileName}`)
  }

  pushCount(parts, metadata.createdCount, tFor('auditCopy.countCreated', lang))
  pushCount(parts, metadata.skippedDuplicateCount, tFor('auditCopy.countSkippedDuplicates', lang))
  pushCount(parts, metadata.invalidRowCount, tFor('auditCopy.countInvalidRows', lang))
  pushCount(parts, metadata.duplicateExistingCount, tFor('auditCopy.countExistingDuplicates', lang))
  pushCount(parts, metadata.duplicateBatchCount, tFor('auditCopy.countBatchDuplicates', lang))
  pushCount(parts, metadata.rowCount, tFor('auditCopy.countRows', lang))
  pushCount(parts, metadata.transactionCount, tFor('auditCopy.countTransactions', lang))
  pushCount(parts, metadata.accountCount, tFor('auditCopy.countAccounts', lang))
  pushCount(parts, metadata.instrumentCount, tFor('auditCopy.countInstruments', lang))
  pushCount(parts, metadata.targetCount, tFor('auditCopy.countTargets', lang))
  pushCount(parts, metadata.appPreferenceCount, tFor('auditCopy.countAppSettings', lang))
  pushCount(parts, metadata.importProfileCount, tFor('auditCopy.countImportProfiles', lang))
  pushCount(parts, metadata.retentionCount, tFor('auditCopy.countRetention', lang))

  if (metadata.safetyBackupFileName && metadata.safetyBackupFileName !== 'none') {
    parts.push(`${tFor('auditCopy.safetyBackupPrefix', lang)} ${metadata.safetyBackupFileName}`)
  }

  return parts.length > 0 ? parts.join(' · ') : null
}

export function buildAuditMetadataEntries(metadata: Record<string, string>, isPolish: boolean): Array<[string, string]> {
  const lang = toLanguage(isPolish)

  const labels: Record<string, string> = {
    upstream: tFor('auditCopy.metaUpstream', lang),
    operation: tFor('auditCopy.metaOperation', lang),
    symbol: tFor('auditCopy.metaSymbol', lang),
    instrumentName: tFor('auditCopy.metaInstrumentName', lang),
    valuationSource: tFor('auditCopy.metaValuationSource', lang),
    purchaseDate: tFor('auditCopy.metaPurchaseDate', lang),
    from: tFor('auditCopy.metaFrom', lang),
    to: tFor('auditCopy.metaTo', lang),
    statusCode: tFor('auditCopy.metaStatusCode', lang),
    responseBodyPreview: tFor('auditCopy.metaResponseBodyPreview', lang),
    reason: tFor('auditCopy.metaReason', lang),
    exceptionType: tFor('auditCopy.metaExceptionType', lang),
    mode: tFor('auditCopy.metaMode', lang),
    trigger: tFor('auditCopy.metaTrigger', lang),
    sourceLabel: tFor('auditCopy.metaSourceLabel', lang),
    sourceFileName: tFor('auditCopy.metaSourceFileName', lang),
    profileName: tFor('auditCopy.metaProfileName', lang),
    createdCount: tFor('auditCopy.metaCreatedCount', lang),
    skippedDuplicateCount: tFor('auditCopy.metaSkippedDuplicateCount', lang),
    invalidRowCount: tFor('auditCopy.metaInvalidRowCount', lang),
    duplicateExistingCount: tFor('auditCopy.metaDuplicateExistingCount', lang),
    duplicateBatchCount: tFor('auditCopy.metaDuplicateBatchCount', lang),
    rowCount: tFor('auditCopy.metaRowCount', lang),
    transactionCount: tFor('auditCopy.metaTransactionCount', lang),
    accountCount: tFor('auditCopy.metaAccountCount', lang),
    appPreferenceCount: tFor('auditCopy.metaAppPreferenceCount', lang),
    instrumentCount: tFor('auditCopy.metaInstrumentCount', lang),
    targetCount: tFor('auditCopy.metaTargetCount', lang),
    importProfileCount: tFor('auditCopy.metaImportProfileCount', lang),
    retentionCount: tFor('auditCopy.metaRetentionCount', lang),
    safetyBackupFileName: tFor('auditCopy.metaSafetyBackupFileName', lang),
    error: tFor('auditCopy.metaError', lang),
    failureMessage: tFor('auditCopy.metaFailureMessage', lang),
    name: tFor('auditCopy.metaName', lang),
    delimiter: tFor('auditCopy.metaDelimiter', lang),
    dateFormat: tFor('auditCopy.metaDateFormat', lang),
    decimalSeparator: tFor('auditCopy.metaDecimalSeparator', lang),
    institution: tFor('auditCopy.metaInstitution', lang),
    type: tFor('auditCopy.metaType', lang),
    baseCurrency: tFor('auditCopy.metaBaseCurrency', lang),
    displayOrder: tFor('auditCopy.metaDisplayOrder', lang),
    orderedAccountIds: tFor('auditCopy.metaOrderedAccountIds', lang),
    kind: tFor('auditCopy.metaKind', lang),
    assetClass: tFor('auditCopy.metaAssetClass', lang),
    currency: tFor('auditCopy.metaCurrency', lang),
    accountId: tFor('auditCopy.metaAccountId', lang),
    instrumentId: tFor('auditCopy.metaInstrumentId', lang),
    tradeDate: tFor('auditCopy.metaTradeDate', lang),
    settlementDate: tFor('auditCopy.metaSettlementDate', lang),
    grossAmount: tFor('auditCopy.metaGrossAmount', lang),
    sizeBytes: tFor('auditCopy.metaSizeBytes', lang),
  }

  return Object.entries(metadata)
    .filter(([, value]) => value.trim().length > 0)
    .sort(([left], [right]) => metadataSortOrder(left) - metadataSortOrder(right) || left.localeCompare(right))
    .map(([key, value]) => [labels[key] ?? humanizeMetadataKey(key), translateMetadataValue(key, value, isPolish)])
}

export function isHighImpactAuditAction(action: string) {
  return ['DELETED', 'RESTORED', 'IMPORTED', 'PRUNED', 'FAILED'].some((marker) => action.includes(marker))
}

function toLanguage(isPolish: boolean): UiLanguage {
  return isPolish ? 'pl' : 'en'
}

function pushCount(parts: string[], value: string | undefined, label: string) {
  if (value && value !== '0') {
    parts.push(`${label} ${value}`)
  }
}

function formatAuditSource(metadata: Record<string, string>) {
  if (metadata.sourceLabel && metadata.sourceFileName) {
    return `${metadata.sourceLabel} (${metadata.sourceFileName})`
  }
  return metadata.sourceLabel ?? metadata.sourceFileName ?? null
}

function labelTransactionKind(event: AuditEventLike) {
  const rawType =
    event.metadata.type ??
    extractMessagePart(event.message, /^Created ([A-Z_]+) transaction\.$/) ??
    extractMessagePart(event.message, /^Updated ([A-Z_]+) transaction\.$/)

  return rawType ? labelTransactionType(rawType) : null
}

function extractMessagePart(message: string, pattern: RegExp) {
  return message.match(pattern)?.[1] ?? null
}

function labelAuditTrigger(trigger: string) {
  switch (trigger) {
    case 'MANUAL':
      return 'ręcznie'
    case 'SCHEDULED':
      return 'harmonogram'
    case 'STARTUP':
      return 'start aplikacji'
    case 'PRE_RESTORE_REPLACE':
      return 'przed przywróceniem REPLACE'
    default:
      return trigger
  }
}

function labelUpstream(upstream: string) {
  switch (upstream) {
    case 'stock-analyst':
      return 'Stock Analyst'
    case 'edo-calculator':
      return 'kalkulator EDO'
    case 'gold-api':
      return 'gold-api'
    default:
      return upstream
  }
}

function translateMetadataValue(key: string, value: string, isPolish: boolean) {
  if (!isPolish) {
    return value
  }

  switch (key) {
    case 'trigger':
      return labelAuditTrigger(value)
    case 'type':
      return labelTransactionType(value)
    case 'kind':
      return labelInstrumentKind(value)
    case 'assetClass':
      return labelAssetClass(value)
    case 'valuationSource':
      return labelValuationSource(value)
    case 'delimiter':
      return value === 'COMMA' ? 'Przecinek' : value === 'SEMICOLON' ? 'Średnik' : value === 'TAB' ? 'Tabulator' : value
    case 'decimalSeparator':
      return value === 'COMMA' ? 'Przecinek' : value === 'DOT' ? 'Kropka' : value
    case 'dateFormat':
      return value === 'ISO_LOCAL_DATE' ? 'RRRR-MM-DD' : value === 'DD_MM_YYYY' ? 'DD.MM.RRRR' : value === 'MM_DD_YYYY' ? 'MM/DD/RRRR' : value
    case 'baseCurrency':
    case 'currency':
    case 'mode':
    case 'symbol':
    case 'statusCode':
      return value
    case 'upstream':
      return labelUpstream(value)
    default:
      return value
  }
}

function metadataSortOrder(key: string) {
  const priority = [
    'upstream',
    'operation',
    'symbol',
    'instrumentName',
    'purchaseDate',
    'from',
    'to',
    'statusCode',
    'responseBodyPreview',
    'mode',
    'trigger',
    'sourceLabel',
    'sourceFileName',
    'profileName',
    'reason',
    'failureMessage',
  ]

  const index = priority.indexOf(key)
  return index === -1 ? priority.length : index
}

function humanizeMetadataKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (match) => match.toUpperCase())
}

function humanizeAuditAction(action: string) {
  return action
    .toLowerCase()
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}
