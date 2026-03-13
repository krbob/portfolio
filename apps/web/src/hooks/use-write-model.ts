import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAccount,
  createInstrument,
  createTransaction,
  listAccounts,
  listInstruments,
  listTransactions,
  type CreateAccountPayload,
  type CreateInstrumentPayload,
  type CreateTransactionPayload,
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
      await queryClient.invalidateQueries({ queryKey: ['accounts'] })
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
      await queryClient.invalidateQueries({ queryKey: ['instruments'] })
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
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTransactionPayload) => createTransaction(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['instruments'] }),
      ])
    },
  })
}
