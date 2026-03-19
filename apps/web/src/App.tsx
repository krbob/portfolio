import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { AppShell } from './components/AppShell'
import { DashboardScreen } from './screens/DashboardScreen'
import { HoldingsScreen } from './screens/HoldingsScreen'
import { PerformanceScreen } from './screens/PerformanceScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TransactionsScreen } from './screens/TransactionsScreen'

export function App() {
  return (
    <AuthGate>
      <AppShell>
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
      </AppShell>
    </AuthGate>
  )
}
