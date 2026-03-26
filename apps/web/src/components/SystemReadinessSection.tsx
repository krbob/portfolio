import { useAppReadiness } from '../hooks/use-app-readiness'
import { Card, SectionHeader } from './ui'
import { formatDateTime } from '../lib/format'
import { useI18n } from '../lib/i18n'
import { labelReadinessStatus } from '../lib/labels'
import { badge, badgeVariants } from '../lib/styles'

export function SystemReadinessSection() {
  const { isPolish } = useI18n()
  const readinessQuery = useAppReadiness()
  const readiness = readinessQuery.data

  return (
    <Card>
      <SectionHeader
        eyebrow={isPolish ? 'Stan systemu' : 'Health'}
        title={isPolish ? 'Gotowość środowiska' : 'Runtime readiness'}
        description={isPolish
          ? 'Sprawdź bazę danych, kopie zapasowe, źródła danych rynkowych i logowanie, zanim zaufasz stanowi portfela.'
          : 'Verify storage, backups, market-data wiring and authentication before trusting the portfolio state.'}
      />

      {readinessQuery.isLoading && <p className="text-sm text-zinc-500">{isPolish ? 'Sprawdzanie usług i zależności środowiska...' : 'Checking runtime dependencies...'}</p>}
      {readinessQuery.isError && <p className="text-sm text-red-400">{readinessQuery.error.message}</p>}

      {readiness && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{isPolish ? 'Stan ogólny' : 'Overall status'}</span>
              <strong className="mt-1 block text-sm text-zinc-100">{formatOverallStatus(readiness.status)}</strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{isPolish ? 'Blokery' : 'Blocking issues'}</span>
              <strong className="mt-1 block text-sm text-zinc-100">{countChecks(readiness.checks, 'FAIL')}</strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{isPolish ? 'Uwagi' : 'Advisory notices'}</span>
              <strong className="mt-1 block text-sm text-zinc-100">
                {countChecks(readiness.checks, 'WARN') + countChecks(readiness.checks, 'INFO')}
              </strong>
            </article>
            <article className="rounded-lg border border-zinc-800/50 p-4">
              <span className="text-xs text-zinc-500">{isPolish ? 'Sprawdzone o' : 'Checked at'}</span>
              <strong className="mt-1 block text-sm text-zinc-100">{formatDateTime(readiness.checkedAt)}</strong>
            </article>
          </div>

          <div className="space-y-3">
            {readiness.checks.map((check) => (
              <article className="rounded-lg border border-zinc-800/50 p-4" key={check.key}>
                <div className="flex items-start justify-between">
                  <div>
                    <strong className="text-sm text-zinc-100">{formatCheckLabel(check.key, check.label, isPolish)}</strong>
                    <p className="text-sm text-zinc-500">{check.key}</p>
                  </div>
                  <span className={`${badge} ${readinessBadgeVariant(check.status)}`}>
                    {labelCheckStatus(check.status, isPolish)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">{formatCheckMessage(check, isPolish)}</p>
                {check.details && Object.keys(check.details).length > 0 ? (
                  <details className="mt-3 rounded-md border border-zinc-800/50 bg-zinc-950/50 p-3">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                      {isPolish ? 'Szczegóły upstreamu' : 'Upstream details'}
                    </summary>
                    <dl className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,180px)_1fr]">
                      {Object.entries(check.details).map(([key, value]) => (
                        <div className="contents" key={key}>
                          <dt className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                            {labelDetailKey(key, isPolish)}
                          </dt>
                          <dd className="break-words font-mono text-xs text-zinc-300">{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

function countChecks(
  checks: Array<{ status: string }>,
  status: 'FAIL' | 'WARN' | 'INFO' | 'PASS',
) {
  return checks.filter((check) => check.status === status).length
}

function formatOverallStatus(status: string) {
  return labelReadinessStatus(status)
}

function readinessBadgeVariant(status: string) {
  switch (status) {
    case 'PASS':
      return badgeVariants.success
    case 'WARN':
      return badgeVariants.warning
    case 'FAIL':
      return badgeVariants.error
    case 'INFO':
      return badgeVariants.info
    default:
      return badgeVariants.default
  }
}

function labelCheckStatus(status: string, isPolish: boolean) {
  if (!isPolish) {
    return status
  }

  switch (status) {
    case 'PASS':
      return 'OK'
    case 'WARN':
      return 'UWAGA'
    case 'FAIL':
      return 'BŁĄD'
    case 'INFO':
      return 'INFO'
    default:
      return status
  }
}

function labelDetailKey(key: string, isPolish: boolean) {
  const labels: Record<string, string> = {
    upstream: isPolish ? 'Usługa' : 'Upstream',
    operation: isPolish ? 'Operacja' : 'Operation',
    symbol: isPolish ? 'Symbol' : 'Symbol',
    statusCode: isPolish ? 'Status HTTP' : 'HTTP status',
    responseBodyPreview: isPolish ? 'Treść odpowiedzi' : 'Response body',
  }

  return labels[key] ?? key
}

function formatCheckLabel(key: string, label: string, isPolish: boolean) {
  if (!isPolish) {
    return label
  }

  switch (key) {
    case 'sqlite-directory':
      return 'Katalog bazy SQLite'
    case 'sqlite-connection':
      return 'Połączenie z bazą SQLite'
    case 'backups-directory':
      return 'Kopie zapasowe'
    case 'market-data':
      return 'Dane rynkowe'
    case 'stock-analyst':
      return 'Stock Analyst'
    case 'edo-calculator':
      return 'Kalkulator EDO'
    case 'gold-market-data':
      return 'Dane o złocie'
    case 'auth':
      return 'Uwierzytelnianie'
    default:
      return label
  }
}

function formatCheckMessage(
  check: {
    key: string
    status: string
    message: string
    details?: Record<string, string>
  },
  isPolish: boolean,
) {
  if (!isPolish) {
    return check.message
  }

  switch (check.key) {
    case 'sqlite-directory':
      return check.status === 'PASS'
        ? 'Katalog bazy SQLite jest dostępny i można w nim zapisywać dane.'
        : check.message === 'Database path must have a parent directory.'
          ? 'Ścieżka do bazy SQLite musi wskazywać katalog nadrzędny.'
          : 'Nie udało się zweryfikować katalogu bazy SQLite.'
    case 'sqlite-connection':
      return check.status === 'PASS'
        ? 'Połączenie z bazą SQLite działa poprawnie.'
        : check.status === 'INFO'
          ? 'W tym trybie aplikacji nie ma podłączonego źródła danych.'
          : 'Nie udało się nawiązać połączenia z bazą SQLite.'
    case 'backups-directory':
      return check.status === 'PASS'
        ? 'Katalog kopii zapasowych jest gotowy do użycia.'
        : check.status === 'INFO'
          ? 'Kopie zapasowe po stronie serwera są wyłączone.'
          : 'Nie udało się zweryfikować katalogu kopii zapasowych.'
    case 'market-data':
      return 'Integracja z danymi rynkowymi jest wyłączona.'
    case 'stock-analyst':
      return formatProbeMessage('Stock Analyst', check)
    case 'edo-calculator':
      return formatProbeMessage('Kalkulator EDO', check)
    case 'gold-market-data':
      return formatGoldMessage(check)
    case 'auth':
      return check.status === 'PASS'
        ? 'Logowanie hasłem jest włączone.'
        : 'Aplikacja działa w trybie jednoużytkownikowym bez logowania hasłem.'
    default:
      return check.message
  }
}

function formatProbeMessage(
  serviceName: string,
  check: { status: string; details?: Record<string, string>; message: string },
) {
  if (check.status === 'PASS') {
    return `Usługa ${serviceName} odpowiada poprawnie.`
  }

  if (check.status === 'INFO') {
    return `Usługa ${serviceName} nie jest podłączona w tym trybie aplikacji.`
  }

  const operation = check.details?.operation ? ` podczas operacji ${labelProbeOperation(check.details.operation)}` : ''
  const statusCode = check.details?.statusCode ? ` Kod HTTP: ${check.details.statusCode}.` : ''
  return `Usługa ${serviceName} zwróciła błąd${operation}.${statusCode}`.replace('..', '.')
}

function formatGoldMessage(check: { status: string; details?: Record<string, string>; message: string }) {
  if (check.status === 'PASS') {
    return 'Źródło wyceny złota odpowiada poprawnie.'
  }

  if (check.status === 'INFO') {
    const fallbackMatch = check.message.match(/fallback benchmark (.+)\./)
    const benchmark = fallbackMatch?.[1]
    return benchmark
      ? `Klucz do wyceny złota nie jest skonfigurowany. Używany jest benchmark zastępczy ${benchmark}.`
      : 'Klucz do wyceny złota nie jest skonfigurowany.'
  }

  const operation = check.details?.operation ? ` podczas operacji ${labelProbeOperation(check.details.operation)}` : ''
  const statusCode = check.details?.statusCode ? ` Kod HTTP: ${check.details.statusCode}.` : ''
  return `Źródło wyceny złota zwróciło błąd${operation}.${statusCode}`.replace('..', '.')
}

function labelProbeOperation(operation: string) {
  switch (operation) {
    case 'current':
      return 'pobierania bieżącej ceny'
    case 'history':
      return 'pobierania historii'
    case 'reference-history':
      return 'pobierania historii benchmarku'
    case 'inflation':
      return 'pobierania inflacji'
    case 'monthly-inflation':
      return 'pobierania miesięcznej inflacji'
    case 'gold-history':
      return 'pobierania historii złota'
    default:
      return operation
  }
}
