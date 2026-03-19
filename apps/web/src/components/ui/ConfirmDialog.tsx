import { Modal } from './Modal'
import { btnDanger, btnSecondary } from '../../lib/styles'

interface ConfirmDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'default'
}

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'default',
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={variant === 'danger' ? btnDanger : btnSecondary}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-zinc-400">{message}</p>
    </Modal>
  )
}
