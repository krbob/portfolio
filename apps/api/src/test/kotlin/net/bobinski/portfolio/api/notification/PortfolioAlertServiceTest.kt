package net.bobinski.portfolio.api.notification

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
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
}
