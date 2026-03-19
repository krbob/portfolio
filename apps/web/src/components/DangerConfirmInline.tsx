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
  cancelLabel = 'Cancel',
  confirmPendingLabel = 'Working...',
  isPending = false,
  onCancel,
  onConfirm,
}: DangerConfirmInlineProps) {
  return (
    <div className="danger-confirm">
      <div className="danger-confirm-copy">
        <strong>{title}</strong>
        <p>{description}</p>
      </div>

      <div className="danger-confirm-actions">
        <button type="button" className="button-secondary" onClick={onCancel} disabled={isPending}>
          {cancelLabel}
        </button>
        <button type="button" className="button-danger" onClick={onConfirm} disabled={isPending}>
          {isPending ? confirmPendingLabel : confirmLabel}
        </button>
      </div>
    </div>
  )
}
