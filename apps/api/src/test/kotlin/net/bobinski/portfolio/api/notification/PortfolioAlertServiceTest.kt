package net.bobinski.portfolio.api.notification

import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.service.BenchmarkKey
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertSame
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.Test

class PortfolioAlertServiceTest {
    @Test
    fun `benchmark underperformance alerts only use the target mix benchmark`() {
        assertTrue(isBenchmarkUnderperformanceAlertBenchmark(BenchmarkKey.TARGET_MIX.name))
        assertFalse(isBenchmarkUnderperformanceAlertBenchmark(BenchmarkKey.VWRA.name))
        assertFalse(isBenchmarkUnderperformanceAlertBenchmark(BenchmarkKey.INFLATION.name))
        assertFalse(isBenchmarkUnderperformanceAlertBenchmark(BenchmarkKey.VAGF.name))
    }

    @Test
    fun `alert section exposes evaluation failures instead of returning an empty result`() {
        val cause = IllegalStateException("overview unavailable")

        val error = assertThrows<PortfolioAlertEvaluationException> {
            runBlocking {
                alertSection(PortfolioAlertType.MARKET_DATA_STALE) {
                    throw cause
                }
            }
        }

        assertEquals(PortfolioAlertType.MARKET_DATA_STALE, error.type)
        assertEquals("Failed to evaluate MARKET_DATA_STALE portfolio alerts.", error.message)
        assertSame(cause, error.cause)
    }

    @Test
    fun `alert section preserves coroutine cancellation`() {
        val cancellation = CancellationException("request cancelled")

        val error = assertThrows<CancellationException> {
            runBlocking {
                alertSection(PortfolioAlertType.ALLOCATION_DRIFT) {
                    throw cancellation
                }
            }
        }

        assertSame(cancellation, error)
    }

    @Test
    fun `alert localization supports Polish and English without changing alert identity`() {
        val alert = PortfolioAlert(
            id = "allocation:CASH",
            type = PortfolioAlertType.ALLOCATION_DRIFT,
            severity = PortfolioAlertSeverity.WARNING,
            content = PortfolioAlertContent.AllocationDrift(
                assetClass = AssetClass.CASH,
                driftPctPoints = "12.50",
                thresholdPctPoints = "5.00"
            ),
            route = "/strategy/targets",
            observedAt = Instant.parse("2026-07-13T10:00:00Z")
        )

        val polish = alert.localize(PortfolioLocale.PL)
        val english = alert.localize(PortfolioLocale.EN)

        assertEquals(alert.id, polish.id)
        assertEquals(alert.id, english.id)
        assertEquals("Dryf alokacji: gotówka", polish.title)
        assertEquals("Odchylenie wynosi 12.50 pp przy progu 5.00 pp.", polish.message)
        assertEquals("Allocation drift: cash", english.title)
        assertEquals("The deviation is 12.50 pp against a 5.00 pp threshold.", english.message)
    }

    @Test
    fun `accept language uses quality weights and safe compatibility fallback`() {
        assertEquals(PortfolioLocale.EN, PortfolioLocale.fromAcceptLanguage("pl;q=0.4, en-GB;q=0.9"))
        assertEquals(PortfolioLocale.PL, PortfolioLocale.fromAcceptLanguage("pl-PL, en;q=0.5"))
        assertEquals(PortfolioLocale.PL, PortfolioLocale.fromAcceptLanguage(null))
        assertEquals(PortfolioLocale.PL, PortfolioLocale.fromAcceptLanguage("de-DE, invalid;q=broken"))
    }
}
