import { btnDanger, btnSecondary } from '../lib/styles'
import { t } from '../lib/messages'

interface DangerConfirmInlineProps {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  confirmPendingLabel?: string
  isPending?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DangerConfirmInline({
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmPendingLabel,
  isPending = false,
  onCancel,
  onConfirm,
}: DangerConfirmInlineProps) {
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel')
  const resolvedPendingLabel = confirmPendingLabel ?? t('common.processing')

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start justify-between gap-4">
      <div>
        <strong className="text-sm font-medium text-zinc-100">{title}</strong>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button type="button" className={btnSecondary} onClick={onCancel} disabled={isPending}>
          {resolvedCancelLabel}
        </button>
        <button type="button" className={btnDanger} onClick={onConfirm} disabled={isPending}>
          {isPending ? resolvedPendingLabel : confirmLabel}
        </button>
      </div>
    </div>
  )
}
