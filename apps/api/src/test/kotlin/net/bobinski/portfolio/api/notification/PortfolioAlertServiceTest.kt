package net.bobinski.portfolio.api.notification

import net.bobinski.portfolio.api.domain.service.BenchmarkKey
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class PortfolioAlertServiceTest {
    @Test
    fun `benchmark underperformance alerts only use the target mix benchmark`() {
        assertTrue(isBenchmarkUnderperformanceAlertBenchmark(BenchmarkKey.TARGET_MIX.name))
        assertFalse(isBenchmarkUnderperformanceAlertBenchmark(BenchmarkKey.VWRA.name))
        assertFalse(isBenchmarkUnderperformanceAlertBenchmark(BenchmarkKey.INFLATION.name))
        assertFalse(isBenchmarkUnderperformanceAlertBenchmark(BenchmarkKey.VAGF.name))
    }
}
