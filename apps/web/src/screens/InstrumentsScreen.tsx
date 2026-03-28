import { useEffect, useMemo, useRef, useState } from 'react'
import { InstrumentsSection } from '../components/InstrumentsSection'
import { PageHeader } from '../components/layout'
import { Badge, Card, EmptyState, ErrorState, LoadingState, SectionHeader } from '../components/ui'
import { useAppMeta } from '../hooks/use-app-meta'
import { usePortfolioHoldings } from '../hooks/use-read-model'
import { useInstruments } from '../hooks/use-write-model'
import { formatCurrencyPln } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelAssetClass, labelInstrumentKind, labelValuationSource } from '../lib/labels'
import { t } from '../lib/messages'
import { usePersistentState } from '../lib/persistence'
import {
  describeHoldingGainRate,
  describePortfolioGain,
  formatHoldingQuantity,
  formatPortfolioGainDisplay,
  parsePortfolioNumber,
} from '../lib/portfolio-presentation'
import { buildStockAnalystAnalysisUrl } from '../lib/stock-analyst'
import { badge, td, tdRight, tr } from '../lib/styles'
import { InstrumentDetailsCard, InstrumentSummaryTile, SortableHeader } from './instruments/InstrumentsScreenSections'
import { buildInstrumentRows, compareRows, defaultSort, isSortState, labelInstrumentStatus, statusVariant } from './instruments/InstrumentsScreenModel'
import type { SortState } from './instruments/InstrumentsScreenModel'

const INSTRUMENTS_PREFERENCE_KEYS = {
  sortState: 'portfolio:view:instruments:sort-state',
} as const

export function InstrumentsScreen() {
  return (
    <>
      <PageHeader title={t('instrumentsScreen.title')}>
        <InstrumentsPageHeaderContent />
      </PageHeader>
      <InstrumentsManagement />
    </>
  )
}

function InstrumentsPageHeaderContent() {
  const { isPolish } = useI18n()
  const instrumentsQuery = useInstruments()
  const holdingsQuery = usePortfolioHoldings()
  const catalog = useMemo(() => instrumentsQuery.data ?? [], [instrumentsQuery.data])
  const holdings = useMemo(() => holdingsQuery.data ?? [], [holdingsQuery.data])
  const rows = useMemo(() => buildInstrumentRows(catalog, holdings), [catalog, holdings])
  const totalValuePln = rows.reduce((sum, row) => sum + row.totalCurrentValuePln, 0)

  if (instrumentsQuery.isLoading || holdingsQuery.isLoading || rows.length === 0) {
    return null
  }

  return (
    <>
      <Badge variant="default">
        {rows.length} {isPolish ? (rows.length === 1 ? 'instrument' : 'instrumentów') : 'instruments'}
      </Badge>
      {rows.length > 0 && (
        <span className="text-sm tabular-nums text-zinc-400">{formatCurrencyPln(totalValuePln)}</span>
      )}
    </>
  )
}

export function InstrumentsManagement() {
  const { isPolish } = useI18n()
  const appMetaQuery = useAppMeta()
  const instrumentsQuery = useInstruments()
  const holdingsQuery = usePortfolioHoldings()

  const catalog = useMemo(() => instrumentsQuery.data ?? [], [instrumentsQuery.data])
  const holdings = useMemo(() => holdingsQuery.data ?? [], [holdingsQuery.data])
  const rows = useMemo(() => buildInstrumentRows(catalog, holdings), [catalog, holdings])
  const [sortState, setSortState] = usePersistentState<SortState>(INSTRUMENTS_PREFERENCE_KEYS.sortState, defaultSort, { validate: isSortState })
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null)
  const sortedRows = useMemo(() => [...rows].sort((left, right) => compareRows(left, right, sortState)), [rows, sortState])

  const activeRows = rows.filter((row) => row.holdingCount > 0)
  const degradedCount = rows.filter((row) => row.status === 'DEGRADED' && row.holdingCount > 0).length
  const staleCount = rows.filter((row) => row.status === 'STALE').length
  const totalValuePln = rows.reduce((sum, row) => sum + row.totalCurrentValuePln, 0)
  const totalGainPln = rows.reduce((sum, row) => sum + row.totalUnrealizedGainPln, 0)
  const totalHoldingCount = rows.reduce((sum, row) => sum + row.holdingCount, 0)
  const totalValuedHoldingCount = rows.reduce((sum, row) => sum + row.valuedHoldingCount, 0)
  const selectedRow = sortedRows.find((row) => row.instrument.id === selectedInstrumentId) ?? sortedRows[0] ?? null
  const selectedHoldings = useMemo(
    () => holdings
      .filter((holding) => holding.instrumentId === selectedRow?.instrument.id)
      .sort((left, right) => parsePortfolioNumber(right.currentValuePln ?? right.bookValuePln) - parsePortfolioNumber(left.currentValuePln ?? left.bookValuePln)),
    [holdings, selectedRow?.instrument.id],
  )
  const detailRef = useRef<HTMLDivElement>(null)

  const stockAnalystAnalysisUrl = buildStockAnalystAnalysisUrl(
    appMetaQuery.data?.stockAnalystUiUrl,
    selectedRow?.instrument.valuationSource === 'STOCK_ANALYST' ? selectedRow.instrument.symbol : null,
  )

  useEffect(() => {
    if (sortedRows.length === 0) {
      setSelectedInstrumentId(null)
      return
    }

    if (!selectedInstrumentId || !sortedRows.some((row) => row.instrument.id === selectedInstrumentId)) {
      setSelectedInstrumentId(sortedRows[0]?.instrument.id ?? null)
    }
  }, [sortedRows, selectedInstrumentId])

  useEffect(() => {
    if (selectedInstrumentId && detailRef.current?.scrollIntoView) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selectedInstrumentId])

  if (instrumentsQuery.isLoading || holdingsQuery.isLoading) {
    return (
      <LoadingState
        title={t('instrumentsScreen.loadingTitle')}
        description={t('instrumentsScreen.loadingDescription')}
        blocks={4}
      />
    )
  }

  if (instrumentsQuery.isError || holdingsQuery.isError) {
    return (
      <ErrorState
        title={t('instrumentsScreen.errorTitle')}
        description={t('instrumentsScreen.errorDescription')}
        onRetry={() => {
          void Promise.all([instrumentsQuery.refetch(), holdingsQuery.refetch()])
        }}
      />
    )
  }

  return (
    <>
      {rows.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InstrumentSummaryTile
            label={t('instrumentsScreen.catalog')}
            value={String(rows.length)}
            detail={isPolish ? `${activeRows.length} aktywnych w portfelu` : `${activeRows.length} active in portfolio`}
          />
          <InstrumentSummaryTile
            label={t('instrumentsScreen.totalValue')}
            value={formatCurrencyPln(totalValuePln)}
            detail={isPolish ? `${activeRows.length} pozycji po zsumowaniu wszystkich rachunków` : `${activeRows.length} aggregates across accounts`}
          />
          <InstrumentSummaryTile
            label={t('instrumentsScreen.unrealizedPL')}
            value={formatPortfolioGainDisplay(totalGainPln, totalValuedHoldingCount, isPolish)}
            detail={describePortfolioGain(totalHoldingCount, totalValuedHoldingCount, isPolish)}
            tone={totalValuedHoldingCount === 0 ? 'default' : totalGainPln >= 0 ? 'success' : 'warning'}
          />
          <InstrumentSummaryTile
            label={t('instrumentsScreen.degradedInstruments')}
            value={String(degradedCount)}
            detail={degradedCount === 0
              ? staleCount === 0
                ? t('instrumentsScreen.freshValuation')
                : (isPolish ? `${staleCount} ma wycenę rynkową z opóźnieniem` : `${staleCount} have stale market valuation`)
              : (isPolish
                  ? `Część instrumentów korzysta z niepełnej lub księgowej wyceny${staleCount > 0 ? ` · ${staleCount} z opóźnieniem` : ''}`
                  : `Some series fall back to book basis${staleCount > 0 ? ` · ${staleCount} stale` : ''}`)}
            tone={degradedCount === 0 && staleCount === 0 ? 'success' : 'warning'}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),26rem]">
        <div className="grid gap-6">
          <Card flush>
            <div className="border-b border-zinc-800 px-5 py-4">
              <SectionHeader
                eyebrow={t('instrumentsScreen.readModel')}
                title={t('instrumentsScreen.instrumentOverview')}
                description={t('instrumentsScreen.overviewDescription')}
              />
            </div>

            {rows.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title={t('instrumentsScreen.noInstrumentsTitle')}
                  description={t('instrumentsScreen.noInstrumentsDescription')}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-950/30">
                    <tr>
                      <SortableHeader sort={sortState} field="instrumentName" label={t('instrumentsScreen.instrumentColumn')} onToggle={setSortState} />
                      <SortableHeader sort={sortState} field="catalog" label={t('instrumentsScreen.catalogColumn')} onToggle={setSortState} />
                      <SortableHeader sort={sortState} field="accountCount" label={t('instrumentsScreen.accountsColumn')} onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="quantity" label={t('instrumentsScreen.quantityColumn')} onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="totalCurrentValuePln" label={t('instrumentsScreen.valueColumn')} onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="totalUnrealizedGainPln" label="P/L" onToggle={setSortState} align="right" />
                      <SortableHeader sort={sortState} field="status" label={t('instrumentsScreen.statusColumn')} onToggle={setSortState} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row) => {
                      const isSelected = selectedRow?.instrument.id === row.instrument.id
                      return (
                        <tr
                          className={`${tr} cursor-pointer ${isSelected ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-500/30' : ''}`}
                          key={row.instrument.id}
                          aria-selected={isSelected}
                          onClick={() => setSelectedInstrumentId(row.instrument.id)}
                        >
                          <td className={td}>
                            <div>
                              <p className="font-medium text-zinc-100">{row.instrument.name}</p>
                              <p className="text-xs text-zinc-500">
                                {row.instrument.symbol ? `${row.instrument.symbol} · ` : ''}
                                {row.instrument.currency}
                              </p>
                            </div>
                          </td>
                          <td className={td}>
                            <div>
                              <p className="text-zinc-200">
                                {labelInstrumentKind(row.instrument.kind)} · {labelAssetClass(row.instrument.assetClass)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {labelValuationSource(row.instrument.valuationSource)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{row.accountCount}</p>
                              <p className="text-xs text-zinc-500">
                                {row.accountCount === 0
                                  ? t('instrumentsScreen.catalogOnly')
                                  : t('instrumentsScreen.activeAccounts')}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{row.accountCount === 0 ? '0' : formatHoldingQuantity(row.quantity)}</p>
                              <p className="text-xs text-zinc-500">
                                {row.transactionCount} {t('instrumentsScreen.transactions')}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className="tabular-nums text-zinc-100">{formatCurrencyPln(row.totalCurrentValuePln)}</p>
                              <p className="text-xs text-zinc-500">
                                {t('instrumentsScreen.costBasis')} {formatCurrencyPln(row.totalBookValuePln)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <div>
                              <p className={`tabular-nums ${
                                row.valuedHoldingCount === 0
                                  ? 'text-zinc-500'
                                  : row.totalUnrealizedGainPln >= 0
                                    ? 'text-emerald-400'
                                    : 'text-red-400'
                              }`}>
                                {formatPortfolioGainDisplay(row.totalUnrealizedGainPln, row.valuedHoldingCount, isPolish)}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {describeHoldingGainRate(row.holdingCount, row.valuedHoldingCount, row.gainPct, isPolish)}
                              </p>
                            </div>
                          </td>
                          <td className={tdRight}>
                            <span className={`${badge} ${statusVariant(row.status)}`}>
                              {labelInstrumentStatus(row.status, isPolish)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {selectedRow && (
            <div ref={detailRef}>
              <InstrumentDetailsCard
                row={selectedRow}
                holdings={selectedHoldings}
                isPolish={isPolish}
                analysisUrl={stockAnalystAnalysisUrl}
              />
            </div>
          )}
        </div>

        <InstrumentsSection />
      </div>
    </>
  )
}
