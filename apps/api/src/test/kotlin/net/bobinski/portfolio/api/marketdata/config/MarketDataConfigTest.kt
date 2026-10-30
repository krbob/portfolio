package net.bobinski.portfolio.api.marketdata.config

import io.ktor.server.config.MapApplicationConfig
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows

class MarketDataConfigTest {
    @Test
    fun `concurrency defaults to two and environment overrides application config`() {
        assertEquals(2, MarketDataConfig.from(MapApplicationConfig()) { null }.stockAnalystMaxConcurrentRequests)
        val config = MapApplicationConfig("portfolio.marketData.stockAnalystMaxConcurrentRequests" to "3")
        assertEquals(3, MarketDataConfig.from(config) { null }.stockAnalystMaxConcurrentRequests)
        val env = mapOf("PORTFOLIO_STOCK_ANALYST_MAX_CONCURRENT_REQUESTS" to "4")
        assertEquals(4, MarketDataConfig.from(config, env::get).stockAnalystMaxConcurrentRequests)
    }

    @Test
    fun `invalid concurrency fails instead of silently changing capacity`() {
        for (value in listOf("0", "-1", "four", "2.5", "2147483648")) {
            val env = mapOf("PORTFOLIO_STOCK_ANALYST_MAX_CONCURRENT_REQUESTS" to value)
            assertThrows<IllegalArgumentException> {
                MarketDataConfig.from(MapApplicationConfig(), env::get)
            }
        }
    }
}
