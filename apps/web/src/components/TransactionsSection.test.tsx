import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TransactionsSection } from './TransactionsSection'
import { I18nProvider } from '../lib/i18n'
import { usePortfolioAuditEvents, usePortfolioHoldings } from '../hooks/use-read-model'
import {
  useAccounts,
  useCreateTransaction,
  useCreateTransactionImportProfile,
  useDeleteTransaction,
  useDeleteTransactionImportProfile,
  useImportTransactions,
  useImportTransactionsCsv,
  useInstruments,
  usePreviewTransactionsImport,
  usePreviewTransactionsCsvImport,
  useTransactionImportProfiles,
  useTransactions,
  useUpdateTransaction,
  useUpdateTransactionImportProfile,
} from '../hooks/use-write-model'

vi.mock('../hooks/use-read-model', () => ({
  usePortfolioAuditEvents: vi.fn(),
  usePortfolioHoldings: vi.fn(),
}))

vi.mock('../hooks/use-write-model', () => ({
  useAccounts: vi.fn(),
  useCreateTransaction: vi.fn(),
  useCreateTransactionImportProfile: vi.fn(),
  useDeleteTransaction: vi.fn(),
  useDeleteTransactionImportProfile: vi.fn(),
  useImportTransactions: vi.fn(),
  useImportTransactionsCsv: vi.fn(),
  useInstruments: vi.fn(),
  usePreviewTransactionsImport: vi.fn(),
  usePreviewTransactionsCsvImport: vi.fn(),
  useTransactionImportProfiles: vi.fn(),
  useTransactions: vi.fn(),
  useUpdateTransaction: vi.fn(),
  useUpdateTransactionImportProfile: vi.fn(),
}))

function setLanguage(language: 'pl' | 'en') {
  const locale = language === 'pl' ? 'pl-PL' : 'en-GB'
  Object.defineProperty(window.navigator, 'language', {
    configurable: true,
    value: locale,
  })
  Object.defineProperty(window.navigator, 'languages', {
    configurable: true,
    value: [locale],
  })
}

function queryResultStub<T>(data: T) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as const
}

function mutationStub() {
  return {
    isPending: false,
    error: null,
    mutateAsync: vi.fn(),
  } as const
}

describe('TransactionsSection', () => {
  it('sends users to Accounts instead of Settings when no accounts exist', () => {
    setLanguage('pl')

    vi.mocked(useAccounts).mockReturnValue(queryResultStub([]) as unknown as ReturnType<typeof useAccounts>)
    vi.mocked(useInstruments).mockReturnValue(queryResultStub([]) as unknown as ReturnType<typeof useInstruments>)
    vi.mocked(useTransactions).mockReturnValue(queryResultStub([]) as unknown as ReturnType<typeof useTransactions>)
    vi.mocked(useTransactionImportProfiles).mockReturnValue(queryResultStub([]) as unknown as ReturnType<typeof useTransactionImportProfiles>)
    vi.mocked(usePortfolioHoldings).mockReturnValue(queryResultStub([]) as unknown as ReturnType<typeof usePortfolioHoldings>)
    vi.mocked(usePortfolioAuditEvents).mockReturnValue(queryResultStub([]) as unknown as ReturnType<typeof usePortfolioAuditEvents>)

    vi.mocked(useCreateTransaction).mockReturnValue(mutationStub() as unknown as ReturnType<typeof useCreateTransaction>)
    vi.mocked(useUpdateTransaction).mockReturnValue(mutationStub() as unknown as ReturnType<typeof useUpdateTransaction>)
    vi.mocked(useDeleteTransaction).mockReturnValue(mutationStub() as unknown as ReturnType<typeof useDeleteTransaction>)
    vi.mocked(useCreateTransactionImportProfile).mockReturnValue(mutationStub() as unknown as ReturnType<typeof useCreateTransactionImportProfile>)
    vi.mocked(useUpdateTransactionImportProfile).mockReturnValue(mutationStub() as unknown as ReturnType<typeof useUpdateTransactionImportProfile>)
    vi.mocked(useDeleteTransactionImportProfile).mockReturnValue(mutationStub() as unknown as ReturnType<typeof useDeleteTransactionImportProfile>)
    vi.mocked(usePreviewTransactionsCsvImport).mockReturnValue(mutationStub() as unknown as ReturnType<typeof usePreviewTransactionsCsvImport>)
    vi.mocked(useImportTransactionsCsv).mockReturnValue(mutationStub() as unknown as ReturnType<typeof useImportTransactionsCsv>)
    vi.mocked(usePreviewTransactionsImport).mockReturnValue(mutationStub() as unknown as ReturnType<typeof usePreviewTransactionsImport>)
    vi.mocked(useImportTransactions).mockReturnValue(mutationStub() as unknown as ReturnType<typeof useImportTransactions>)

    render(
      <MemoryRouter>
        <I18nProvider>
          <TransactionsSection />
        </I18nProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('Brak jeszcze kont')).toBeInTheDocument()
    expect(screen.getByText(/na ekranie Konta/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Przejdź do Kont' })).toHaveAttribute('href', '/portfolio/accounts')
  })
})
