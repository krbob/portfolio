import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAccount,
  createInstrument,
  createTransaction,
  deleteTransaction,
  downloadPortfolioBackup,
  exportPortfolioState,
  importTransactions,
  importPortfolioState,
  listAccounts,
  listInstruments,
  listPortfolioBackups,
  listPortfolioTargets,
  listTransactions,
  previewPortfolioStateImport,
  replacePortfolioTargets,
  restorePortfolioBackup,
  runPortfolioBackup,
  updateTransaction,
  type CreateAccountPayload,
  type CreateInstrumentPayload,
  type ImportPortfolioStatePayload,
  type ImportTransactionsPayload,
  type CreateTransactionPayload,
  type PortfolioBackupRecord,
  type PortfolioTarget,
  type PreviewPortfolioStateImportResult,
  type ReplacePortfolioTargetsPayload,
  type PortfolioStateSnapshot,
  type RestorePortfolioBackupPayload,
  type RestorePortfolioBackupResult,
  type UpdateTransactionPayload,
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

export function usePortfolioTargets() {
  return useQuery({
    queryKey: ['portfolio-targets'],
    queryFn: listPortfolioTargets,
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
      ])
    },
  })
}

export function useRunPortfolioBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (): Promise<PortfolioBackupRecord> => runPortfolioBackup(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolio-backups'] })
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
        queryClient.invalidateQueries({ queryKey: ['portfolio-backups'] }),
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
      await invalidateTransactionRelatedQueries(queryClient)
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
    queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-overview'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-daily-history'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-returns'] }),
  ])
}
