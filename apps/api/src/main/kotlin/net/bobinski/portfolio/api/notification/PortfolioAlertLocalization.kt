package net.bobinski.portfolio.api.notification

import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.service.BenchmarkKey

enum class PortfolioLocale(val code: String) {
    PL("pl"),
    EN("en");

    companion object {
        val DEFAULT: PortfolioLocale = PL

        fun fromLanguageTag(value: String?): PortfolioLocale =
            value?.trim()?.lowercase()
                ?.let { normalized ->
                    entries.firstOrNull { locale ->
                        normalized == locale.code || normalized.startsWith("${locale.code}-")
                    }
                }
                ?: DEFAULT

        fun fromAcceptLanguage(value: String?): PortfolioLocale {
            if (value.isNullOrBlank()) return DEFAULT
            return value.split(',')
                .mapIndexedNotNull { index, candidate -> candidate.toLanguagePreference(index) }
                .sortedWith(compareByDescending<LanguagePreference> { it.quality }.thenBy { it.index })
                .firstNotNullOfOrNull { preference -> supportedLocale(preference.tag) }
                ?: DEFAULT
        }

        private fun supportedLocale(tag: String): PortfolioLocale? {
            val normalized = tag.trim().lowercase()
            return entries.firstOrNull { locale ->
                normalized == locale.code || normalized.startsWith("${locale.code}-")
            }
        }

        private fun String.toLanguagePreference(index: Int): LanguagePreference? {
            val parts = split(';').map(String::trim)
            val tag = parts.firstOrNull()?.takeIf { it.isNotBlank() } ?: return null
            val quality = parts.drop(1)
                .firstOrNull { part -> part.startsWith("q=", ignoreCase = true) }
                ?.substringAfter('=')
                ?.toDoubleOrNull()
                ?.takeIf { it in 0.0..1.0 }
                ?: if (parts.size == 1) 1.0 else 0.0
            if (quality == 0.0) return null
            return LanguagePreference(tag = tag, quality = quality, index = index)
        }
    }
}

data class LocalizedPortfolioAlert(
    val id: String,
    val type: PortfolioAlertType,
    val severity: PortfolioAlertSeverity,
    val title: String,
    val message: String,
    val route: String,
    val observedAt: java.time.Instant
)

fun PortfolioAlert.localize(locale: PortfolioLocale): LocalizedPortfolioAlert {
    val (title, message) = content.localize(locale)
    return LocalizedPortfolioAlert(
        id = id,
        type = type,
        severity = severity,
        title = title,
        message = message,
        route = route,
        observedAt = observedAt
    )
}

private fun PortfolioAlertContent.localize(locale: PortfolioLocale): Pair<String, String> = when (this) {
    is PortfolioAlertContent.MarketDataStale -> when (locale) {
        PortfolioLocale.PL -> "Dane rynkowe są opóźnione" to
            "Pełną wycenę ma $valuedHoldingCount z $activeHoldingCount aktywnych pozycji."
        PortfolioLocale.EN -> "Market data is delayed" to
            "Full valuations are available for $valuedHoldingCount of $activeHoldingCount active positions."
    }

    is PortfolioAlertContent.AllocationDrift -> when (locale) {
        PortfolioLocale.PL -> "Dryf alokacji: ${assetClass.label(locale)}" to
            "Odchylenie wynosi $driftPctPoints pp przy progu $thresholdPctPoints pp."
        PortfolioLocale.EN -> "Allocation drift: ${assetClass.label(locale)}" to
            "The deviation is $driftPctPoints pp against a $thresholdPctPoints pp threshold."
    }

    is PortfolioAlertContent.BenchmarkUnderperformance -> when (locale) {
        PortfolioLocale.PL -> benchmarkTitle(locale) to
            "Nadwyżka TWR dla $periodLabel wynosi $excessTimeWeightedReturnPctPoints pp."
        PortfolioLocale.EN -> benchmarkTitle(locale) to
            "TWR excess for $periodLabel is $excessTimeWeightedReturnPctPoints pp."
    }
}

private fun PortfolioAlertContent.BenchmarkUnderperformance.benchmarkTitle(locale: PortfolioLocale): String =
    when (locale) {
        PortfolioLocale.PL -> if (benchmarkKey == BenchmarkKey.TARGET_MIX.name) {
            "Portfel odstaje od alokacji docelowej"
        } else {
            "Portfel odstaje od benchmarku $benchmarkLabel"
        }
        PortfolioLocale.EN -> if (benchmarkKey == BenchmarkKey.TARGET_MIX.name) {
            "Portfolio trails its target allocation"
        } else {
            "Portfolio trails benchmark $benchmarkLabel"
        }
    }

private fun AssetClass.label(locale: PortfolioLocale): String = when (locale) {
    PortfolioLocale.PL -> when (this) {
        AssetClass.EQUITIES -> "akcje"
        AssetClass.BONDS -> "obligacje"
        AssetClass.CASH -> "gotówka"
        AssetClass.FX -> "waluty"
        AssetClass.BENCHMARK -> "benchmarki"
    }
    PortfolioLocale.EN -> when (this) {
        AssetClass.EQUITIES -> "equities"
        AssetClass.BONDS -> "bonds"
        AssetClass.CASH -> "cash"
        AssetClass.FX -> "currencies"
        AssetClass.BENCHMARK -> "benchmarks"
    }
}

private data class LanguagePreference(
    val tag: String,
    val quality: Double,
    val index: Int
)
