import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Toast, type ToastVariant } from '../../hooks/use-toast'
import { ToastContainer } from './Toast'

const MAX_VISIBLE = 3
const AUTO_DISMISS_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const add = useCallback((message: string, variant: ToastVariant) => {
    const id = nextId.current++
    setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, variant }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, AUTO_DISMISS_MS)
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback((message: string) => add(message, 'success'), [add])
  const error = useCallback((message: string) => add(message, 'error'), [add])
  const info = useCallback((message: string) => add(message, 'info'), [add])

  return (
    <ToastContext value={{ toasts, success, error, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext>
  )
}
