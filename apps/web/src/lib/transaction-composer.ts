export interface TransactionComposerDraft {
  accountId: string
  instrumentId?: string
  type?: string
  tradeDate?: string
  settlementDate?: string
  quantity?: string
  unitPrice?: string
  grossAmount?: string
  feeAmount?: string
  taxAmount?: string
  currency?: string
  fxRateToPln?: string
  notes?: string
}

export interface TransactionRouteState {
  transactionDraft?: TransactionComposerDraft | null
}
