import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAccount,
  createInstrument,
  createTransaction,
  deleteTransaction,
  importTransactions,
  listAccounts,
  listInstruments,
  listTransactions,
  updateTransaction,
  type CreateAccountPayload,
  type CreateInstrumentPayload,
  type ImportTransactionsPayload,
  type CreateTransactionPayload,
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

function useTransactionInvalidateQueryClient() {
  const queryClient = useQueryClient()
  return queryClient
}

async function invalidateTransactionRelatedQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['accounts'] }),
    queryClient.invalidateQueries({ queryKey: ['instruments'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-overview'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-holdings'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-daily-history'] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio-returns'] }),
  ])
}
