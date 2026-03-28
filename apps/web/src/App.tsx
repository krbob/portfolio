import { Suspense, lazy, useCallback } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/layout'
import { t } from './lib/messages'

const DashboardScreen = lazy(async () => {
  const module = await import('./screens/DashboardScreen')
  return { default: module.DashboardScreen }
})

const HoldingsScreen = lazy(async () => {
  const module = await import('./screens/HoldingsScreen')
  return { default: module.HoldingsScreen }
})

const AccountsScreen = lazy(async () => {
  const module = await import('./screens/AccountsScreen')
  return { default: module.AccountsScreen }
})

const PerformanceScreen = lazy(async () => {
  const module = await import('./screens/PerformanceScreen')
  return { default: module.PerformanceScreen }
})

const TransactionsScreen = lazy(async () => {
  const module = await import('./screens/TransactionsScreen')
  return { default: module.TransactionsScreen }
})

const SettingsScreen = lazy(async () => {
  const module = await import('./screens/SettingsScreen')
  return { default: module.SettingsScreen }
})

export function App() {
  const navigate = useNavigate()
  const handleErrorReset = useCallback(() => { navigate('/') }, [navigate])

  return (
    <AuthGate>
      <Layout>
        <ErrorBoundary onReset={handleErrorReset}>
          <Suspense fallback={<RouteLoadingState />}>
            <Routes>
              <Route path="/" element={<DashboardScreen />} />
              <Route path="/holdings" element={<HoldingsScreen />} />
              <Route path="/accounts" element={<AccountsScreen />} />
              <Route path="/instruments" element={<Navigate to="/settings#instruments" replace />} />
              <Route path="/performance" element={<PerformanceScreen />} />
              <Route path="/returns" element={<Navigate to="/performance" replace />} />
              <Route path="/charts" element={<Navigate to="/performance" replace />} />
              <Route path="/transactions" element={<TransactionsScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/data" element={<Navigate to="/settings" replace />} />
              <Route path="/backups" element={<Navigate to="/settings#backups" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </AuthGate>
  )
}

function RouteLoadingState() {
  return (
    <div className="space-y-3 py-16 text-center">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {t('common.loading')}
      </p>
      <h2 className="text-lg font-semibold text-zinc-300">
        {t('app.loadingTitle')}
      </h2>
      <p className="text-sm text-zinc-500">
        {t('app.loadingDescription')}
      </p>
    </div>
  )
}
