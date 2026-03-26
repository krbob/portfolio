import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAccount,
  createInstrument,
  createTransaction,
  createTransactionImportProfile,
  deleteTransaction,
  deleteTransactionImportProfile,
  downloadPortfolioBackup,
  exportPortfolioState,
  invalidateReadModelCache,
  getReadModelRefreshStatus,
  importTransactionsCsv,
  importTransactions,
  importPortfolioState,
  listAccounts,
  getPortfolioBenchmarkSettings,
  getPortfolioRebalancingSettings,
  listInstruments,
  listPortfolioBackups,
  savePortfolioBenchmarkSettings,
  savePortfolioRebalancingSettings,
  listPortfolioTargets,
  listTransactionImportProfiles,
  listTransactions,
  previewTransactionsCsvImport,
  previewTransactionsImport,
  previewPortfolioStateImport,
  reorderAccounts,
  replacePortfolioTargets,
  restorePortfolioBackup,
  runReadModelRefresh,
  runPortfolioBackup,
  updateTransactionImportProfile,
  updateTransaction,
  type CreateAccountPayload,
  type CreateInstrumentPayload,
  type CsvTransactionsImportPayload,
  type CreateTransactionPayload,
  type ImportPortfolioStatePayload,
  type ImportTransactionsPayload,
  type ImportTransactionsPreviewResult,
  type PortfolioBenchmarkSettings,
  type PortfolioBackupRecord,
  type PortfolioRebalancingSettings,
  type PortfolioTarget,
  type ReadModelCacheInvalidationResult,
  type ReorderAccountsPayload,
  type SaveTransactionImportProfilePayload,
  type SavePortfolioBenchmarkSettingsPayload,
  type SavePortfolioRebalancingSettingsPayload,
  type PreviewPortfolioStateImportResult,
  type ReplacePortfolioTargetsPayload,
  type PortfolioStateSnapshot,
  type ReadModelRefreshRunResult,
  type RestorePortfolioBackupPayload,
  type RestorePortfolioBackupResult,
  type TransactionImportProfile,
  type UpdateTransactionPayload,
  type UpdateTransactionImportProfilePayload,
} from '../api/write-model'

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: listAccounts,
  })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateAccountPayload) => createAccount(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
      ])
    },
  })
}

export function useReorderAccounts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ReorderAccountsPayload) => reorderAccounts(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
      ])
    },
  })
}

export function useInstruments() {
  return useQuery({
    queryKey: ['instruments'],
    queryFn: listInstruments,
  })
}

export function useCreateInstrument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInstrumentPayload) => createInstrument(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['instruments'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
      ])
    },
  })
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: listTransactions,
  })
}

export function useCreateTransaction() {
  const queryClient = useTransactionInvalidateQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTransactionPayload) => createTransaction(payload),
    onSuccess: async () => {
      await invalidateTransactionRelatedQueries(queryClient)
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useTransactionInvalidateQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateTransactionPayload) => updateTransaction(payload),
    onSuccess: async () => {
      await invalidateTransactionRelatedQueries(queryClient)
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useTransactionInvalidateQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: async () => {
      await invalidateTransactionRelatedQueries(queryClient)
    },
  })
}

export function useImportTransactions() {
  const queryClient = useTransactionInvalidateQueryClient()
  return useMutation({
    mutationFn: (payload: ImportTransactionsPayload) => importTransactions(payload),
    onSuccess: async () => {
      await invalidateTransactionRelatedQueries(queryClient)
    },
  })
}

export function usePreviewTransactionsImport() {
  return useMutation({
    mutationFn: (payload: ImportTransactionsPayload): Promise<ImportTransactionsPreviewResult> =>
      previewTransactionsImport(payload),
  })
}

export function useTransactionImportProfiles() {
  return useQuery({
    queryKey: ['transaction-import-profiles'],
    queryFn: listTransactionImportProfiles,
  })
}

export function useCreateTransactionImportProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SaveTransactionImportProfilePayload): Promise<TransactionImportProfile> =>
      createTransactionImportProfile(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['transaction-import-profiles'] })
    },
  })
}

export function useUpdateTransactionImportProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      payload: UpdateTransactionImportProfilePayload,
    ): Promise<TransactionImportProfile> => updateTransactionImportProfile(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['transaction-import-profiles'] })
    },
  })
}

export function useDeleteTransactionImportProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTransactionImportProfile(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['transaction-import-profiles'] })
    },
  })
}

export function usePreviewTransactionsCsvImport() {
  return useMutation({
    mutationFn: (payload: CsvTransactionsImportPayload): Promise<ImportTransactionsPreviewResult> =>
      previewTransactionsCsvImport(payload),
  })
}

export function useImportTransactionsCsv() {
  const queryClient = useTransactionInvalidateQueryClient()
  return useMutation({
    mutationFn: (payload: CsvTransactionsImportPayload) => importTransactionsCsv(payload),
    onSuccess: async () => {
      await invalidateTransactionRelatedQueries(queryClient)
    },
  })
}

export function useExportPortfolioState() {
  return useMutation({
    mutationFn: (): Promise<PortfolioStateSnapshot> => exportPortfolioState(),
  })
}

export function usePortfolioBackups() {
  return useQuery({
    queryKey: ['portfolio-backups'],
    queryFn: listPortfolioBackups,
  })
}

export function usePortfolioBenchmarkSettings() {
  return useQuery({
    queryKey: ['portfolio-benchmark-settings'],
    queryFn: getPortfolioBenchmarkSettings,
  })
}

export function usePortfolioRebalancingSettings() {
  return useQuery({
    queryKey: ['portfolio-rebalancing-settings'],
    queryFn: getPortfolioRebalancingSettings,
  })
}

export function usePortfolioTargets() {
  return useQuery({
    queryKey: ['portfolio-targets'],
    queryFn: listPortfolioTargets,
  })
}

export function useSavePortfolioBenchmarkSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SavePortfolioBenchmarkSettingsPayload): Promise<PortfolioBenchmarkSettings> =>
      savePortfolioBenchmarkSettings(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portfolio-benchmark-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-returns'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-read-model-cache'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
      ])
    },
  })
}

export function useReplacePortfolioTargets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ReplacePortfolioTargetsPayload): Promise<PortfolioTarget[]> =>
      replacePortfolioTargets(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portfolio-targets'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-daily-history'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-returns'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-read-model-cache'] }),
      ])
    },
  })
}

export function useSavePortfolioRebalancingSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (
      payload: SavePortfolioRebalancingSettingsPayload,
    ): Promise<PortfolioRebalancingSettings> => savePortfolioRebalancingSettings(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
      ])
    },
  })
}

export function useInvalidateReadModelCache() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (): Promise<ReadModelCacheInvalidationResult> => invalidateReadModelCache(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portfolio-read-model-cache'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-daily-history'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-returns'] }),
      ])
    },
  })
}

export function useReadModelRefreshStatus() {
  return useQuery({
    queryKey: ['read-model-refresh-status'],
    queryFn: getReadModelRefreshStatus,
  })
}

export function useRunReadModelRefresh() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (): Promise<ReadModelRefreshRunResult> => runReadModelRefresh(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['read-model-refresh-status'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-read-model-cache'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-daily-history'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-returns'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
      ])
    },
  })
}

export function useRunPortfolioBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (): Promise<PortfolioBackupRecord> => runPortfolioBackup(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portfolio-backups'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
      ])
    },
  })
}

export function useDownloadPortfolioBackup() {
  return useMutation({
    mutationFn: (fileName: string): Promise<string> => downloadPortfolioBackup(fileName),
  })
}

export function useRestorePortfolioBackup() {
  const queryClient = useTransactionInvalidateQueryClient()
  return useMutation({
    mutationFn: (payload: RestorePortfolioBackupPayload): Promise<RestorePortfolioBackupResult> =>
      restorePortfolioBackup(payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateTransactionRelatedQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['transaction-import-profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-benchmark-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['read-model-refresh-status'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-read-model-cache'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-backups'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
      ])
    },
  })
}

export function usePreviewPortfolioStateImport() {
  return useMutation({
    mutationFn: (payload: ImportPortfolioStatePayload): Promise<PreviewPortfolioStateImportResult> =>
      previewPortfolioStateImport(payload),
  })
}

export function useImportPortfolioState() {
  const queryClient = useTransactionInvalidateQueryClient()
  return useMutation({
    mutationFn: (payload: ImportPortfolioStatePayload) => importPortfolioState(payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateTransactionRelatedQueries(queryClient),
        queryClient.invalidateQueries({ queryKey: ['transaction-import-profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-benchmark-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-rebalancing-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['read-model-refresh-status'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-read-model-cache'] }),
        queryClient.invalidateQueries({ queryKey: ['portfolio-backups'] }),
      ])
    },
  })
}

function useTransactionInvalidateQueryClient() {
  const queryClient = useQueryClient()
  return queryClient
}

async function invalidateTransactionRelatedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['accounts'] }),
    queryClient.invalidateQueries({ queryKey: ['instruments'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-audit-events'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-overview'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-daily-history'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-returns'] }),
  ])
}
