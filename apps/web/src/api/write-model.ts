export interface Account {
  id: string
  name: string
  institution: string
  type: string
  baseCurrency: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Instrument {
  id: string
  name: string
  kind: string
  assetClass: string
  symbol: string | null
  currency: string
  valuationSource: string
  edoTerms: {
    purchaseDate: string
    firstPeriodRateBps: number
    marginBps: number
    principalUnits: number
    maturityDate: string
  } | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  accountId: string
  instrumentId: string | null
  type: string
  tradeDate: string
  settlementDate: string | null
  quantity: string | null
  unitPrice: string | null
  grossAmount: string
  feeAmount: string
  taxAmount: string
  currency: string
  fxRateToPln: string | null
  notes: string
  createdAt: string
  updatedAt: string
}

export interface CreateAccountPayload {
  name: string
  institution: string
  type: string
  baseCurrency: string
}

export interface CreateInstrumentPayload {
  name: string
  kind: string
  assetClass: string
  symbol?: string | null
  currency: string
  valuationSource: string
  edoTerms?: {
    purchaseDate: string
    firstPeriodRateBps: number
    marginBps: number
    principalUnits: number
    maturityDate: string
  } | null
}

export interface CreateTransactionPayload {
  accountId: string
  instrumentId?: string | null
  type: string
  tradeDate: string
  settlementDate?: string | null
  quantity?: string | null
  unitPrice?: string | null
  grossAmount: string
  feeAmount?: string
  taxAmount?: string
  currency: string
  fxRateToPln?: string | null
  notes?: string
}

export interface UpdateTransactionPayload extends CreateTransactionPayload {
  id: string
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) {
        message = body.message
      }
    } catch {
      // Keep generic fallback.
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function listAccounts() {
  return requestJson<Account[]>('/api/v1/accounts')
}

export function createAccount(payload: CreateAccountPayload) {
  return requestJson<Account>('/api/v1/accounts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listInstruments() {
  return requestJson<Instrument[]>('/api/v1/instruments')
}

export function createInstrument(payload: CreateInstrumentPayload) {
  return requestJson<Instrument>('/api/v1/instruments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function listTransactions() {
  return requestJson<Transaction[]>('/api/v1/transactions')
}

export function createTransaction(payload: CreateTransactionPayload) {
  return requestJson<Transaction>('/api/v1/transactions', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTransaction(payload: UpdateTransactionPayload) {
  const { id, ...body } = payload
  return requestJson<Transaction>(`/api/v1/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteTransaction(id: string) {
  const response = await fetch(`/api/v1/transactions/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { message?: string }
      if (body.message) {
        message = body.message
      }
    } catch {
      // Keep generic fallback.
    }
    throw new Error(message)
  }
}
