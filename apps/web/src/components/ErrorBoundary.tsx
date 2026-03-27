import { Component, type ErrorInfo, type ReactNode } from 'react'
import { btnPrimary, btnSecondary } from '../lib/styles'
import { t } from '../lib/messages'

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
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.949 3.374H4.646c-1.732 0-2.815-1.874-1.949-3.374L10.051 3.37c.866-1.5 3.032-1.5 3.898 0l7.354 12.756zM12 16.5h.008v.008H12V16.5z"
              />
            </svg>
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
