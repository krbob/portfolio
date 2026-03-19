import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { AppShell } from './components/AppShell'

const DashboardScreen = lazy(async () => {
  const module = await import('./screens/DashboardScreen')
  return { default: module.DashboardScreen }
})

const HoldingsScreen = lazy(async () => {
  const module = await import('./screens/HoldingsScreen')
  return { default: module.HoldingsScreen }
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
  return (
    <AuthGate>
      <AppShell>
        <Suspense fallback={<RouteLoadingState />}>
          <Routes>
            <Route path="/" element={<DashboardScreen />} />
            <Route path="/holdings" element={<HoldingsScreen />} />
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
      </AppShell>
    </AuthGate>
  )
}

function RouteLoadingState() {
  return (
    <div className="page-stack route-loading-state">
      <p className="eyebrow">Loading</p>
      <h2 className="page-title">Preparing workspace</h2>
      <p className="page-copy">Fetching the next screen and attaching its portfolio data dependencies.</p>
    </div>
  )
}
