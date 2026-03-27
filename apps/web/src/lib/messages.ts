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
