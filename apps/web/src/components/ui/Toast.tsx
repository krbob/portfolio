import clsx from 'clsx'
import type { Toast } from '../../hooks/use-toast'
import { IconClose } from './icons'

const variantClasses = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
} as const

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-24 right-8 z-50 flex flex-col-reverse gap-2"
      style={{
        bottom: 'max(6rem, calc(var(--safe-bottom, 0px) + 6rem))',
        right: 'max(2rem, calc(var(--safe-right, 0px) + 2rem))',
      }}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-sm animate-fade-in',
            variantClasses[toast.variant],
          )}
        >
          <span className="min-w-0 flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 rounded-lg p-0.5 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
