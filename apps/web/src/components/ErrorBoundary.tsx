import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '../lib/messages'
import { btnPrimary, btnSecondary } from '../lib/styles'
import { IconWarning } from './ui/icons'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleReset = () => {
    this.setState({ hasError: false })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="mx-auto max-w-lg rounded-xl border border-red-500/25 bg-red-500/5 px-8 py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <IconWarning />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-red-300/80">
            {t('error.eyebrow')}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-zinc-100">
            {t('error.title')}
          </h3>
          <p className="mt-2 max-w-md text-sm text-red-200/70">
            {t('error.description')}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button type="button" className={btnSecondary} onClick={this.handleReset}>
              {t('common.goBack')}
            </button>
            <button type="button" className={btnPrimary} onClick={this.handleReload}>
              {t('error.reload')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
