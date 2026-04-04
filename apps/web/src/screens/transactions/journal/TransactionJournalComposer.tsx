import type { FormEvent } from 'react'
import type { Account, Instrument } from '../../../api/write-model'
import { Modal } from '../../../components/ui/Modal'
import { formatCurrency, formatDate, formatNumber } from '../../../lib/format'
import { labelTransactionType } from '../../../lib/labels'
import { formatMessage, t } from '../../../lib/messages'
import {
  badge,
  btnGhost,
  btnPrimary,
  btnSecondary,
  input,
  label as labelClass,
} from '../../../lib/styles'
import {
  toWholeUnits,
  transactionTypes,
  type TransactionFormState,
} from '../transactions-helpers'

interface RedeemLotPreview {
  consumedQuantity: number
  remainingQuantity: number
}

interface TransactionJournalComposerProps {
  open: boolean
  editingTransactionId: string | null
  form: TransactionFormState
  sortedAccountOptions: Account[]
  selectableInstrumentOptions: Instrument[]
  requiresInstrument: boolean
  decimalSeparator: '.' | ','
  grossAmountMode: 'auto' | 'manual'
  showSettlementDateField: boolean
  selectedRedeemLots: Array<{
    purchaseDate: string
    quantity: string
    costBasisPln: string
    currentValuePln: string | null
    unrealizedGainPln: string | null
    valuationIssue: string | null
  }>
  redeemPreview: {
    requestedQuantity: number
    totalAvailableQuantity: number
    unmatchedQuantity: number
    byPurchaseDate: Map<string, RedeemLotPreview>
  }
  isHoldingsLoading: boolean
  holdingsErrorMessage: string | null
  redeemableEdoHoldingsCount: number
  hasSelectedRedeemHolding: boolean
  createPending: boolean
  updatePending: boolean
  submitErrorMessage: string | null
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onAccountChange: (accountId: string) => void
  onTypeChange: (type: string) => void
  onTradeDateChange: (tradeDate: string) => void
  onInstrumentChange: (instrumentId: string) => void
  onQuantityChange: (quantity: string) => void
  onUnitPriceChange: (unitPrice: string) => void
  onGrossAmountChange: (grossAmount: string) => void
  onApplySuggestedGrossAmount: () => void
  onFeeAmountChange: (feeAmount: string) => void
  onTaxAmountChange: (taxAmount: string) => void
  onCurrencyChange: (currency: string) => void
  onFxRateChange: (fxRateToPln: string) => void
  onNotesChange: (notes: string) => void
  onOpenSettlementDateField: () => void
  onResetSettlementDateToTradeDate: () => void
  onSettlementDateChange: (settlementDate: string) => void
}

export function TransactionJournalComposer({
  open,
  editingTransactionId,
  form,
  sortedAccountOptions,
  selectableInstrumentOptions,
  requiresInstrument,
  decimalSeparator,
  grossAmountMode,
  showSettlementDateField,
  selectedRedeemLots,
  redeemPreview,
  isHoldingsLoading,
  holdingsErrorMessage,
  redeemableEdoHoldingsCount,
  hasSelectedRedeemHolding,
  createPending,
  updatePending,
  submitErrorMessage,
  onClose,
  onSubmit,
  onAccountChange,
  onTypeChange,
  onTradeDateChange,
  onInstrumentChange,
  onQuantityChange,
  onUnitPriceChange,
  onGrossAmountChange,
  onApplySuggestedGrossAmount,
  onFeeAmountChange,
  onTaxAmountChange,
  onCurrencyChange,
  onFxRateChange,
  onNotesChange,
  onOpenSettlementDateField,
  onResetSettlementDateToTradeDate,
  onSettlementDateChange,
}: TransactionJournalComposerProps) {
  const canSubmit = form.accountId !== '' && (!requiresInstrument || form.instrumentId !== '')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingTransactionId ? t('journal.editTransaction') : t('journal.newTransaction')}
      size="2xl"
    >
      <div className="space-y-5">
        <p className="text-sm text-zinc-400">
          {editingTransactionId ? t('journal.editSaveHint') : t('journal.createHint')}
        </p>

        <form className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0" onSubmit={onSubmit}>
          <label>
            <span className={labelClass}>{t('journal.account')}</span>
            <select
              className={input}
              value={form.accountId}
              onChange={(event) => onAccountChange(event.target.value)}
              required
            >
              <option value="">{t('journal.selectAccount')}</option>
              {sortedAccountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>{t('journal.type')}</span>
            <select className={input} value={form.type} onChange={(event) => onTypeChange(event.target.value)}>
              {transactionTypes.map((type) => (
                <option key={type} value={type}>
                  {labelTransactionType(type)}
                </option>
              ))}
            </select>
          </label>

          <label className="overflow-hidden">
            <span className={labelClass}>{t('journal.tradeDate')}</span>
            <input
              className={input}
              type="date"
              value={form.tradeDate}
              onChange={(event) => onTradeDateChange(event.target.value)}
              required
            />
          </label>

          {requiresInstrument && (
            <label>
              <span className={labelClass}>{t('journal.instrument')}</span>
              <select
                className={input}
                value={form.instrumentId}
                onChange={(event) => onInstrumentChange(event.target.value)}
              >
                <option value="">{t('journal.selectInstrument')}</option>
                {selectableInstrumentOptions.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {requiresInstrument && (
            <div>
              <label>
                <span className={labelClass}>{t('journal.quantity')}</span>
                <input
                  className={input}
                  inputMode="numeric"
                  value={form.quantity}
                  onChange={(event) => onQuantityChange(event.target.value)}
                  placeholder="10"
                />
              </label>
              <p className="mt-1 text-xs text-zinc-500">{t('journal.wholeUnitsOnly')}</p>
            </div>
          )}

          {form.type === 'REDEEM' && (
            <div className="col-span-full rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{t('journal.activeEdoLots')}</p>
                  <p className="mt-1 text-sm text-zinc-500">{t('journal.redeemFifoHint')}</p>
                </div>

                {selectedRedeemLots.length > 0 && (
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => onQuantityChange(String(redeemPreview.totalAvailableQuantity))}
                  >
                    {t('journal.redeemAll')}
                  </button>
                )}
              </div>

              {isHoldingsLoading ? (
                <p className="mt-4 text-sm text-zinc-500">{t('journal.loadingEdoLots')}</p>
              ) : holdingsErrorMessage ? (
                <p className="mt-4 text-sm text-amber-300">
                  {formatMessage(t('journal.edoLotsError'), { message: holdingsErrorMessage })}
                </p>
              ) : form.accountId === '' ? (
                <p className="mt-4 text-sm text-zinc-500">{t('journal.selectAccountForLots')}</p>
              ) : redeemableEdoHoldingsCount === 0 ? (
                <p className="mt-4 text-sm text-zinc-500">{t('journal.noEdoLots')}</p>
              ) : !hasSelectedRedeemHolding ? (
                <p className="mt-4 text-sm text-zinc-500">{t('journal.selectEdoSeries')}</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <p className="text-xs uppercase tracking-wider text-zinc-500">{t('journal.availableUnits')}</p>
                      <p className="mt-2 text-lg font-semibold text-zinc-100">
                        {formatNumber(redeemPreview.totalAvailableQuantity, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <p className="text-xs uppercase tracking-wider text-zinc-500">{t('journal.selectedForRedemption')}</p>
                      <p className="mt-2 text-lg font-semibold text-zinc-100">
                        {formatNumber(redeemPreview.requestedQuantity, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                      <p className="text-xs uppercase tracking-wider text-zinc-500">{t('journal.previewShortfall')}</p>
                      <p className="mt-2 text-lg font-semibold text-zinc-100">
                        {formatNumber(redeemPreview.unmatchedQuantity, { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedRedeemLots.map((lot) => {
                      const lotPreview = redeemPreview.byPurchaseDate.get(lot.purchaseDate)
                      const fullyConsumed =
                        lotPreview != null &&
                        lotPreview.consumedQuantity > 0 &&
                        lotPreview.remainingQuantity === 0

                      return (
                        <div key={lot.purchaseDate} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-sm font-medium text-zinc-100">{formatDate(lot.purchaseDate)}</p>
                              <p className="mt-1 text-sm text-zinc-500">
                                {`${formatNumber(lot.quantity, { maximumFractionDigits: 0 })} ${t('journal.lotUnits')} · ${t('journal.lotCost')} ${formatCurrency(lot.costBasisPln, 'PLN')}`}
                              </p>
                              <p className="mt-1 text-sm text-zinc-500">
                                {lot.currentValuePln != null
                                  ? `${t('journal.lotCurrentValue')} ${formatCurrency(lot.currentValuePln, 'PLN')} · ${t('journal.lotPL')} ${formatCurrency(lot.unrealizedGainPln, 'PLN')}`
                                  : lot.valuationIssue ?? t('journal.lotValuationUnavailable')}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {lotPreview != null && lotPreview.consumedQuantity > 0 && (
                                <span className={badge}>
                                  {fullyConsumed
                                    ? t('journal.fullyConsumedFifo')
                                    : formatMessage(t('journal.fifoUnits'), { count: formatNumber(lotPreview.consumedQuantity, { maximumFractionDigits: 0 }) })}
                                </span>
                              )}
                              <button
                                type="button"
                                className={btnGhost}
                                onClick={() => onQuantityChange(String(toWholeUnits(lot.quantity)))}
                              >
                                {t('journal.redeemThisLot')}
                              </button>
                            </div>
                          </div>

                          {lotPreview != null && lotPreview.consumedQuantity > 0 && (
                            <p className="mt-3 text-sm text-zinc-400">
                              {formatMessage(t('journal.fifoRemainder'), { count: formatNumber(lotPreview.remainingQuantity, { maximumFractionDigits: 0 }) })}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {redeemPreview.unmatchedQuantity > 0 && (
                    <p className="text-sm text-amber-300">
                      {formatMessage(t('journal.quantityExceedsLots'), { count: formatNumber(redeemPreview.unmatchedQuantity, { maximumFractionDigits: 0 }) })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {requiresInstrument && (
            <label>
              <span className={labelClass}>{t('journal.unitPrice')}</span>
              <input
                className={input}
                inputMode="decimal"
                value={form.unitPrice}
                onChange={(event) => onUnitPriceChange(event.target.value)}
                placeholder={decimalSeparator === ',' ? '123,45' : '123.45'}
              />
            </label>
          )}

          <div>
            <label className={labelClass} htmlFor="transaction-gross-amount">
              {t('journal.grossAmount')}
            </label>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span>
                {requiresInstrument
                  ? grossAmountMode === 'auto'
                    ? t('journal.grossAmountAuto')
                    : t('journal.grossAmountManual')
                  : t('journal.grossAmountDirect')}
              </span>
              {requiresInstrument && (
                <button type="button" className={btnGhost} onClick={onApplySuggestedGrossAmount}>
                  {t('journal.recalculate')}
                </button>
              )}
            </div>
            <input
              id="transaction-gross-amount"
              className={input}
              inputMode="decimal"
              value={form.grossAmount}
              onChange={(event) => onGrossAmountChange(event.target.value)}
              placeholder={decimalSeparator === ',' ? '246,90' : '246.90'}
              required
            />
          </div>

          <label>
            <span className={labelClass}>{t('journal.feeAmount')}</span>
            <input
              className={input}
              inputMode="decimal"
              value={form.feeAmount}
              onChange={(event) => onFeeAmountChange(event.target.value)}
              placeholder={decimalSeparator === ',' ? '0,00' : '0.00'}
            />
          </label>

          <label>
            <span className={labelClass}>{t('journal.taxAmount')}</span>
            <input
              className={input}
              inputMode="decimal"
              value={form.taxAmount}
              onChange={(event) => onTaxAmountChange(event.target.value)}
              placeholder={decimalSeparator === ',' ? '0,00' : '0.00'}
            />
          </label>

          <label>
            <span className={labelClass}>{t('journal.currency')}</span>
            <input
              className={input}
              value={form.currency}
              onChange={(event) => onCurrencyChange(event.target.value)}
              maxLength={3}
              required
            />
          </label>

          {form.currency !== 'PLN' && (
            <div>
              <label className={labelClass} htmlFor="transaction-fx-rate-to-pln">
                {t('journal.fxRateToPln')}
              </label>
              <input
                id="transaction-fx-rate-to-pln"
                className={input}
                inputMode="decimal"
                value={form.fxRateToPln}
                onChange={(event) => onFxRateChange(event.target.value)}
                placeholder={decimalSeparator === ',' ? '4,0321' : '4.0321'}
              />
              <p className="mt-1 text-xs text-zinc-500">{t('journal.fxRateHint')}</p>
            </div>
          )}

          <label className="col-span-2">
            <span className={labelClass}>{t('journal.notes')}</span>
            <input
              className={input}
              value={form.notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder={t('journal.notesPlaceholder')}
            />
          </label>

          <div className="col-span-full rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-200">{t('journal.settlementDate')}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {showSettlementDateField ? t('journal.settlementCustomHint') : t('journal.settlementDefaultHint')}
                </p>
              </div>

              {showSettlementDateField ? (
                <button type="button" className={btnGhost} onClick={onResetSettlementDateToTradeDate}>
                  {t('journal.useTradeDate')}
                </button>
              ) : (
                <button type="button" className={btnGhost} onClick={onOpenSettlementDateField}>
                  {t('journal.setAnotherDate')}
                </button>
              )}
            </div>

            {showSettlementDateField && (
              <div className="mt-4 grid gap-3 lg:max-w-sm">
                <label>
                  <span className={labelClass}>{t('journal.settlementDate')}</span>
                  <input
                    className={input}
                    type="date"
                    value={form.settlementDate}
                    onChange={(event) => onSettlementDateChange(event.target.value)}
                  />
                </label>
              </div>
            )}
          </div>

          <div className="col-span-full flex flex-wrap items-center gap-3">
            <button
              className={btnPrimary}
              type="submit"
              disabled={!canSubmit || createPending || updatePending}
            >
              {createPending || updatePending
                ? t('common.saving')
                : editingTransactionId
                  ? t('journal.saveChanges')
                  : t('journal.addTransaction')}
            </button>

            <button type="button" className={btnSecondary} onClick={onClose}>
              {editingTransactionId ? t('journal.cancelEdit') : t('journal.closeEditor')}
            </button>
          </div>

          {submitErrorMessage && <p className="col-span-full text-sm text-red-400">{submitErrorMessage}</p>}
        </form>
      </div>
    </Modal>
  )
}
