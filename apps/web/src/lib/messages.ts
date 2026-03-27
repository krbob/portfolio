import { getActiveUiLanguage, type UiLanguage } from './i18n'

type Messages = Record<string, { pl: string; en: string }>

const messages = {
  // ── Common ──────────────────────────────────────────────────────
  'common.loading': { pl: 'Ładowanie', en: 'Loading' },
  'common.retry': { pl: 'Ponów', en: 'Retry' },
  'common.cancel': { pl: 'Anuluj', en: 'Cancel' },
  'common.save': { pl: 'Zapisz', en: 'Save' },
  'common.saving': { pl: 'Zapisywanie...', en: 'Saving...' },
  'common.delete': { pl: 'Usuń', en: 'Delete' },
  'common.working': { pl: 'Trwa...', en: 'Working...' },
  'common.unavailable': { pl: 'Niedostępne', en: 'Unavailable' },
  'common.na': { pl: 'n/d', en: 'n/a' },
  'common.none': { pl: 'Brak', en: 'None yet' },
  'common.all': { pl: 'Wszystkie', en: 'All' },
  'common.noData': { pl: 'Brak danych', en: 'No data' },
  'common.goBack': { pl: 'Wróć', en: 'Go back' },
  'common.processing': { pl: 'Przetwarzanie...', en: 'Working...' },

  // ── App ─────────────────────────────────────────────────────────
  'app.loadingTitle': { pl: 'Przygotowujemy ekran', en: 'Preparing workspace' },
  'app.loadingDescription': { pl: 'Wczytujemy widok i związane z nim dane portfela.', en: 'Attaching the next screen and its portfolio data.' },

  // ── Error Boundary ──────────────────────────────────────────────
  'error.eyebrow': { pl: 'Nieoczekiwany błąd', en: 'Unexpected error' },
  'error.title': { pl: 'Widok uległ awarii', en: 'This view has crashed' },
  'error.description': { pl: 'Wystąpił nieoczekiwany błąd w interfejsie. Możesz odświeżyć stronę lub wrócić do ekranu głównego.', en: 'An unexpected error occurred in the interface. You can reload the page or return to the dashboard.' },
  'error.reload': { pl: 'Odśwież stronę', en: 'Reload page' },

  // ── Mobile App Section ──────────────────────────────────────────
  'mobile.installedTitle': { pl: 'Aplikacja jest zainstalowana', en: 'App is installed' },
  'mobile.installedDescription': { pl: 'Portfolio działa teraz jak osobna aplikacja uruchamiana z ekranu głównego.', en: 'Portfolio is running in an app-like standalone mode.' },
  'mobile.availableTitle': { pl: 'Możesz dodać aplikację do ekranu głównego', en: 'You can install this app' },
  'mobile.availableDescription': { pl: 'Po dodaniu do ekranu głównego aplikacja szybciej otwiera interfejs na telefonie, ale bieżące dane portfela nadal wymagają połączenia z API.', en: 'Installing the app keeps the shell handy on mobile, but live portfolio data still requires API connectivity.' },
  'mobile.eyebrow': { pl: 'Aplikacja', en: 'App' },
  'mobile.sectionTitle': { pl: 'Instalacja na telefonie', en: 'Install on mobile' },
  'mobile.sectionDescription': { pl: 'Portfolio możesz dodać do ekranu głównego telefonu, aby szybciej wracać do aplikacji i korzystać z prostszego trybu pełnoekranowego.', en: 'Portfolio supports a lightweight PWA flow, so you can pin it to your home screen and reopen a cached app shell faster.' },
  'mobile.install': { pl: 'Zainstaluj', en: 'Install' },
  'mobile.dismissed': { pl: 'Okno instalacji zostało zamknięte. Możesz wrócić do tej sekcji później.', en: 'The install prompt was dismissed. You can come back to this section later.' },
  'mobile.howToInstall': { pl: 'Jak zainstalować', en: 'How to install' },
  'mobile.installViaBrowser': { pl: 'Na tej przeglądarce możesz użyć przycisku instalacji powyżej.', en: 'This browser can install the app directly with the button above.' },
  'mobile.installViaIos': { pl: 'Na iPhonie lub iPadzie użyj Udostępnij, a potem Dodaj do ekranu głównego.', en: 'On iPhone or iPad, use Share and then Add to Home Screen.' },
  'mobile.installViaMenu': { pl: 'Jeśli przeglądarka nie pokazuje okna instalacji, użyj jej menu i wybierz opcję dodania aplikacji.', en: 'If the browser does not show an install prompt, use its menu and choose the install option.' },
  'mobile.whatWorksOffline': { pl: 'Co działa offline', en: 'What works offline' },
  'mobile.offlineSupported': { pl: 'Manifest, ikony i ostatnio zapisany interfejs są zapisywane lokalnie po pierwszej wizycie. Dane portfela nadal są pobierane na żywo z API.', en: 'The manifest, icons and last loaded app shell are cached after the first visit. Portfolio data is still fetched live from the API.' },
  'mobile.offlineUnsupported': { pl: 'Ta przeglądarka nie obsługuje mechanizmu offline, więc aplikacja działa wyłącznie online.', en: 'This browser does not expose a service worker, so the app remains online-only.' },

  // ── Benchmark Chart ─────────────────────────────────────────────
  'benchmark.title': { pl: 'Porównanie z benchmarkiem', en: 'Benchmark Comparison' },
  'benchmark.subtitle': { pl: 'Indeksowane do 100 na początku wybranego okresu', en: 'Indexed to 100 at the start of the selected period' },
  'benchmark.portfolio': { pl: 'Portfel', en: 'Portfolio' },
  'benchmark.selectLabel': { pl: 'Wybierz benchmark', en: 'Select benchmark' },

  // ── Allocation Time Chart ───────────────────────────────────────
  'allocation.title': { pl: 'Historia alokacji', en: 'Allocation History' },
  'allocation.subtitle': { pl: 'Akcje, obligacje i gotówka jako procent portfela', en: 'Equities, bonds and cash as percentage of portfolio' },
  'allocation.selectedDate': { pl: 'Wybrany dzień', en: 'Selected date' },
  'allocation.latestDate': { pl: 'Ostatni dzień', en: 'Latest date' },
  'allocation.equities': { pl: 'Akcje', en: 'Equities' },
  'allocation.bonds': { pl: 'Obligacje', en: 'Bonds' },
  'allocation.cash': { pl: 'Gotówka', en: 'Cash' },

  // ── Portfolio Value Chart ───────────────────────────────────────
  'portfolioValue.title': { pl: 'Wartość portfela', en: 'Portfolio Value' },
  'portfolioValue.contributions': { pl: 'Wpłaty', en: 'Contributions' },

  // ── Transactions ────────────────────────────────────────────────
  'transactions.title': { pl: 'Transakcje', en: 'Transactions' },

  // ── Performance ─────────────────────────────────────────────────
  'performance.title': { pl: 'Wyniki', en: 'Performance' },
  'performance.loadingTitle': { pl: 'Ładowanie wyników', en: 'Loading performance' },
  'performance.loadingDescription': { pl: 'Przygotowywanie historii, zwrotów i porównań z benchmarkami dla portfela.', en: 'Preparing history, returns and benchmark comparisons for the portfolio.' },
  'performance.errorTitle': { pl: 'Wyniki niedostępne', en: 'Performance unavailable' },
  'performance.errorDescription': { pl: 'Nie udało się wczytać historii i zwrotów. Spróbuj ponownie albo sprawdź bazę danych oraz gotowość źródeł rynkowych.', en: 'History and return read models could not load. Retry now or inspect storage and market-data readiness.' },
  'performance.emptyTitle': { pl: 'Brak danych o wynikach', en: 'No performance data yet' },
  'performance.emptyDescription': { pl: 'Najpierw zapisz transakcje, aby Portfolio mogło odtworzyć historię dzienną, zwroty i benchmarki.', en: 'Record transactions first so Portfolio can reconstruct daily history, returns and benchmarks.' },
  'performance.emptyAction': { pl: 'Otwórz transakcje', en: 'Open Transactions' },
  'performance.latestValue': { pl: 'Ostatnia wartość', en: 'Latest Value' },
  'performance.inceptionMwrr': { pl: 'MWRR od początku', en: 'Inception MWRR' },
  'performance.tabCharts': { pl: 'Wykresy', en: 'Charts' },
  'performance.tabReturns': { pl: 'Zwroty', en: 'Returns' },
  'performance.workspaceLabel': { pl: 'Przestrzeń wyników', en: 'Performance workspace' },

  // ── Dashboard ───────────────────────────────────────────────────
  'dashboard.title': { pl: 'Pulpit', en: 'Dashboard' },
  'dashboard.loadingTitle': { pl: 'Ładowanie pulpitu', en: 'Loading dashboard' },
  'dashboard.loadingDescription': { pl: 'Przygotowywanie bieżącej wartości portfela, alokacji i najnowszej historii rynkowej.', en: 'Preparing the current portfolio value, allocation and latest market-backed history.' },
  'dashboard.errorTitle': { pl: 'Pulpit niedostępny', en: 'Dashboard unavailable' },
  'dashboard.errorDescription': { pl: 'Nie udało się wczytać podsumowania portfela. Spróbuj ponownie albo sprawdź stan systemu w Ustawieniach.', en: 'Portfolio overview could not load. Retry now or inspect system health in Settings.' },
  'dashboard.welcomeTitle': { pl: 'Witaj w Portfolio', en: 'Welcome to Portfolio' },
  'dashboard.welcomeDescription': { pl: 'Dodaj konto na ekranie Konta, instrument na ekranie Instrumenty i zapisz pierwszą transakcję, aby rozpocząć śledzenie portfela.', en: 'Add an account on the Accounts screen, add an instrument on the Instruments screen, and record your first transaction to start tracking the portfolio.' },
  'dashboard.welcomeAction': { pl: 'Przejdź do Kont', en: 'Go to Accounts' },
  'dashboard.asOf': { pl: 'Stan na', en: 'As of' },

  // ── UI (shared components) ────────────────────────────────────────
  'ui.unavailable': { pl: 'Niedostępne', en: 'Unavailable' },
  'ui.errorTitle': { pl: 'Coś poszło nie tak', en: 'Something went wrong' },
  'ui.errorDescription': { pl: 'Portfolio nie może teraz wczytać tych danych. Spróbuj ponownie albo sprawdź stan systemu w Ustawieniach.', en: 'Portfolio could not load this data right now. Retry or check the system status in Settings.' },
  'ui.loadingEyebrow': { pl: 'Ładowanie', en: 'Loading' },
  'ui.loadingTitle': { pl: 'Ładowanie portfela', en: 'Loading portfolio' },
  'ui.loadingDescription': { pl: 'Pobieranie najnowszych pozycji, wycen i modeli odczytowych portfela.', en: 'Fetching the latest holdings, valuation and portfolio read models.' },
  'ui.empty': { pl: 'Pusto', en: 'Empty' },
  'ui.clear': { pl: 'Wyczyść', en: 'Clear' },

  // ── Layout ────────────────────────────────────────────────────────
  'layout.openNavigation': { pl: 'Otwórz nawigację', en: 'Open navigation' },
  'layout.navigation': { pl: 'Nawigacja', en: 'Navigation' },
  'layout.tagline': { pl: 'Przestrzeń inwestora długoterminowego', en: 'Long-term investing workspace' },
  'layout.runtimeHealth': { pl: 'Stan systemu', en: 'Runtime health' },
  'layout.checkingDeps': { pl: 'Sprawdzanie usług i zależności...', en: 'Checking dependencies...' },
  'layout.readinessUnreachable': { pl: 'Nie udało się odpytać endpointu gotowości.', en: 'Could not reach readiness endpoint.' },
  'layout.openHealth': { pl: 'Otwórz stan systemu', en: 'Open health' },
  'layout.signOut': { pl: 'Wyloguj', en: 'Sign out' },
  'layout.signingOut': { pl: 'Wylogowywanie...', en: 'Signing out...' },
  'layout.statusError': { pl: 'Błąd', en: 'Error' },
  'layout.statusConnecting': { pl: 'Łączenie', en: 'Connecting' },
  'layout.statusHealthy': { pl: 'Gotowy', en: 'Healthy' },
  'layout.statusDegraded': { pl: 'Ograniczony', en: 'Degraded' },
  'layout.statusAdvisory': { pl: 'Uwagi', en: 'Advisory' },
  'layout.statusNotReady': { pl: 'Niegotowy', en: 'Not ready' },

  // ── Auth ──────────────────────────────────────────────────────────
  'auth.startupError': { pl: 'Aplikacja nie mogła wczytać wymaganego stanu startowego.', en: 'The app could not load required startup state.' },
  'auth.connecting': { pl: 'Łączenie', en: 'Connecting' },
  'auth.checkingSession': { pl: 'Sprawdzanie sesji', en: 'Checking session' },
  'auth.checkingSessionDesc': { pl: 'Ładowanie metadanych i stanu uwierzytelnienia.', en: 'Loading metadata and authentication state.' },
  'auth.connectionIssue': { pl: 'Problem z połączeniem', en: 'Connection issue' },
  'auth.notReachable': { pl: 'Nie można połączyć się z Portfolio', en: 'Portfolio is not reachable' },
  'auth.password': { pl: 'Hasło', en: 'Password' },
  'auth.enterPassword': { pl: 'Wpisz hasło', en: 'Enter password' },
  'auth.unlocking': { pl: 'Odblokowywanie...', en: 'Unlocking...' },
  'auth.unlock': { pl: 'Odblokuj', en: 'Unlock' },
  'auth.loginFailed': { pl: 'Logowanie nie powiodło się.', en: 'Login failed.' },
  'auth.selfHosted': { pl: 'Self-hosted tracker portfela', en: 'Self-hosted portfolio tracker' },

  // ── Accounts ──────────────────────────────────────────────────────
  'accounts.eyebrow': { pl: 'Model zapisu', en: 'Write model' },
  'accounts.title': { pl: 'Konta', en: 'Accounts' },
  'accounts.description': { pl: 'Zapisz miejsca przechowywania aktywów, zanim nałożysz na nie analitykę portfela.', en: 'Capture where assets are held before layering portfolio analytics on top.' },
  'accounts.name': { pl: 'Nazwa', en: 'Name' },
  'accounts.institution': { pl: 'Instytucja', en: 'Institution' },
  'accounts.type': { pl: 'Typ', en: 'Type' },
  'accounts.baseCurrency': { pl: 'Waluta bazowa', en: 'Base currency' },
  'accounts.addAccount': { pl: 'Dodaj konto', en: 'Add account' },
  'accounts.loading': { pl: 'Ładowanie kont...', en: 'Loading accounts...' },
  'accounts.empty': { pl: 'Brak kont.', en: 'No accounts yet.' },

  // ── Data Quality ──────────────────────────────────────────────────
  'dataQuality.eyebrow': { pl: 'Jakość danych', en: 'Data quality' },
  'dataQuality.title': { pl: 'Zaufanie do danych portfela', en: 'Portfolio data trust' },
  'dataQuality.description': { pl: 'Sprawdź pokrycie wyceny, benchmarków, CPI oraz ostatnie odświeżenie większych modeli odczytowych.', en: 'Inspect valuation coverage, benchmark coverage, CPI coverage and the latest heavy read-model refresh.' },
  'dataQuality.loadingTitle': { pl: 'Ładowanie jakości danych', en: 'Loading data quality' },
  'dataQuality.loadingDescription': { pl: 'Składanie sygnałów z wyceny, historii, benchmarków i pamięci modeli odczytowych.', en: 'Combining valuation, history, benchmark and read-model cache signals.' },
  'dataQuality.errorTitle': { pl: 'Jakość danych niedostępna', en: 'Data quality unavailable' },
  'dataQuality.errorDescription': { pl: 'Nie udało się złożyć sygnałów jakości danych. Spróbuj ponownie.', en: 'Portfolio could not assemble the current data-quality signals. Retry now.' },
  'dataQuality.status': { pl: 'Status', en: 'Status' },
  'dataQuality.valuation': { pl: 'Wycena', en: 'Valuation' },
  'dataQuality.benchmarks': { pl: 'Benchmarki', en: 'Benchmarks' },
  'dataQuality.cpiThrough': { pl: 'CPI do', en: 'CPI through' },
  'dataQuality.lastRefresh': { pl: 'Ostatni refresh', en: 'Last refresh' },
  'dataQuality.upstreamHint': { pl: 'Szczegóły awarii upstreamów znajdziesz niżej w audycie operacyjnym i panelu gotowości środowiska.', en: 'Detailed upstream failures appear below in the operational audit and runtime readiness panels.' },
  'dataQuality.statusPass': { pl: 'OK', en: 'Healthy' },
  'dataQuality.statusWarn': { pl: 'UWAGA', en: 'Degraded' },
  'dataQuality.statusInfo': { pl: 'INFO', en: 'Info' },

  // ── Cache (ReadModelCacheSection) ─────────────────────────────────
  'cache.eyebrow': { pl: 'Modele odczytowe', en: 'Read models' },
  'cache.title': { pl: 'Migawki pamięci podręcznej', en: 'Cached snapshots' },
  'cache.description': { pl: 'Historia i zwroty są zapisywane jako odtwarzalne modele odczytowe, razem z metadanymi wyjaśniającymi kiedy i dlaczego powstała dana migawka.', en: 'History and returns are cached as rebuildable read models, with metadata that explains when each snapshot was generated and why that generation happened.' },
  'cache.refreshing': { pl: 'Odświeżanie...', en: 'Refreshing...' },
  'cache.refreshNow': { pl: 'Odśwież teraz', en: 'Refresh now' },
  'cache.clearing': { pl: 'Czyszczenie...', en: 'Clearing...' },
  'cache.clearCache': { pl: 'Wyczyść pamięć', en: 'Clear cache' },
  'cache.scheduler': { pl: 'Harmonogram', en: 'Scheduler' },
  'cache.schedulerEnabled': { pl: 'Włączony', en: 'Enabled' },
  'cache.schedulerManual': { pl: 'Tylko ręcznie', en: 'Manual only' },
  'cache.interval': { pl: 'Interwał', en: 'Interval' },
  'cache.snapshots': { pl: 'Migawki', en: 'Snapshots' },
  'cache.totalPayload': { pl: 'Łączny rozmiar danych', en: 'Total payload' },
  'cache.lastRefresh': { pl: 'Ostatnie odświeżenie', en: 'Last refresh' },
  'cache.models': { pl: 'Modele', en: 'Models' },
  'cache.lastTrigger': { pl: 'Ostatnie uruchomienie', en: 'Last trigger' },
  'cache.lastRefreshFailure': { pl: 'Ostatni błąd odświeżania', en: 'Last refresh failure' },
  'cache.loadingSnapshots': { pl: 'Ładowanie migawek pamięci modeli odczytowych...', en: 'Loading read-model cache snapshots...' },
  'cache.loadingRefreshStatus': { pl: 'Ładowanie statusu odświeżania...', en: 'Loading refresh status...' },
  'cache.emptySnapshots': { pl: 'Brak jeszcze migawek modeli odczytowych. Otwórz historię lub zwroty, aby je wygenerować.', en: 'No cached read models yet. Open history or returns to populate them.' },
  'cache.generated': { pl: 'utworzono', en: 'generated' },
  'cache.modelVersion': { pl: 'Wersja modelu', en: 'Version' },
  'cache.inputWindow': { pl: 'Zakres danych wejściowych', en: 'Input window' },
  'cache.sourceUpdated': { pl: 'Aktualizacja źródeł', en: 'Source updated' },
  'cache.payload': { pl: 'Rozmiar', en: 'Payload' },

  // ── Readiness (SystemReadinessSection) ────────────────────────────
  'readiness.eyebrow': { pl: 'Stan systemu', en: 'Health' },
  'readiness.title': { pl: 'Gotowość środowiska', en: 'Runtime readiness' },
  'readiness.description': { pl: 'Sprawdź bazę danych, kopie zapasowe, źródła danych rynkowych i logowanie, zanim zaufasz stanowi portfela.', en: 'Verify storage, backups, market-data wiring and authentication before trusting the portfolio state.' },
  'readiness.loading': { pl: 'Sprawdzanie usług i zależności środowiska...', en: 'Checking runtime dependencies...' },
  'readiness.overallStatus': { pl: 'Stan ogólny', en: 'Overall status' },
  'readiness.blockingIssues': { pl: 'Blokery', en: 'Blocking issues' },
  'readiness.advisoryNotices': { pl: 'Uwagi', en: 'Advisory notices' },
  'readiness.checkedAt': { pl: 'Sprawdzone o', en: 'Checked at' },
  'readiness.upstreamDetails': { pl: 'Szczegóły upstreamu', en: 'Upstream details' },
  'readiness.checkStatusPass': { pl: 'OK', en: 'PASS' },
  'readiness.checkStatusWarn': { pl: 'UWAGA', en: 'WARN' },
  'readiness.checkStatusFail': { pl: 'BŁĄD', en: 'FAIL' },
  'readiness.checkStatusInfo': { pl: 'INFO', en: 'INFO' },
  'readiness.detailUpstream': { pl: 'Usługa', en: 'Upstream' },
  'readiness.detailOperation': { pl: 'Operacja', en: 'Operation' },
  'readiness.detailSymbol': { pl: 'Symbol', en: 'Symbol' },
  'readiness.detailStatusCode': { pl: 'Status HTTP', en: 'HTTP status' },
  'readiness.detailResponseBody': { pl: 'Treść odpowiedzi', en: 'Response body' },

  // ── Instruments ───────────────────────────────────────────────────
  'instruments.eyebrow': { pl: 'Model zapisu', en: 'Write model' },
  'instruments.title': { pl: 'Instrumenty', en: 'Instruments' },
  'instruments.description': { pl: 'Trzymaj ETF-y, benchmarki i miesięczne serie EDO w jednym katalogu instrumentów.', en: 'Keep ETF, benchmark, and monthly EDO series in one canonical catalog.' },
  'instruments.editInstrument': { pl: 'Edytuj instrument', en: 'Edit instrument' },
  'instruments.name': { pl: 'Nazwa', en: 'Name' },
  'instruments.kind': { pl: 'Rodzaj', en: 'Kind' },
  'instruments.assetClass': { pl: 'Klasa aktywów', en: 'Asset class' },
  'instruments.symbol': { pl: 'Symbol', en: 'Symbol' },
  'instruments.currency': { pl: 'Waluta', en: 'Currency' },
  'instruments.valuationSource': { pl: 'Źródło wyceny', en: 'Valuation source' },
  'instruments.seriesMonth': { pl: 'Miesiąc serii', en: 'Series month' },
  'instruments.firstPeriodRate': { pl: 'Oprocentowanie 1. okresu (bps)', en: 'First period rate (bps)' },
  'instruments.margin': { pl: 'Marża (bps)', en: 'Margin (bps)' },
  'instruments.saveChanges': { pl: 'Zapisz zmiany', en: 'Save changes' },
  'instruments.addInstrument': { pl: 'Dodaj instrument', en: 'Add instrument' },
  'instruments.loading': { pl: 'Ładowanie instrumentów...', en: 'Loading instruments...' },
  'instruments.empty': { pl: 'Brak instrumentów.', en: 'No instruments yet.' },
} satisfies Messages

export type MessageKey = keyof typeof messages

export function t(key: MessageKey): string {
  return resolveMessage(messages[key], getActiveUiLanguage())
}

export function tFor(key: MessageKey, language: UiLanguage): string {
  return resolveMessage(messages[key], language)
}

function resolveMessage(entry: { pl: string; en: string }, language: UiLanguage): string {
  return language === 'pl' ? entry.pl : entry.en
}
