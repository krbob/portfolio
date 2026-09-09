package net.bobinski.portfolio.api.marketdata.service

import com.sun.net.httpserver.HttpServer
import io.ktor.server.config.MapApplicationConfig
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZoneOffset
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.service.OperationalStateService
import net.bobinski.portfolio.api.marketdata.client.EdoCalculatorClient
import net.bobinski.portfolio.api.marketdata.config.MarketDataConfig
import net.bobinski.portfolio.api.persistence.inmemory.InMemoryOperationalStateRepository
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class RemoteInflationAdjustmentProviderTest {
    @Test
    fun `unpublished August CPI uses confirmed July data and clears obsolete failure metadata`() = runBlocking {
        Fixture().use { fixture ->
            fixture.cache.recordMonthlyInflationFailure("No CPI data for 2026-08")

            val result = fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER) as InflationSeriesResult.Success

            assertEquals(AUGUST, result.until)
            assertFalse(result.fromCache)
            assertEquals(listOf(AUGUST), fixture.monthlyEnds)
            val status = fixture.cache.listSnapshots().single()
            assertEquals(MarketDataSnapshotStatus.FRESH, status.status)
            assertEquals(0, status.failureCount)
            assertEquals("2026-07", status.sourceAsOf)
        }
    }

    @Test
    fun `concurrent analytics and repeated reloads share a fresh publication check`() = runBlocking {
        Fixture().use { fixture ->
            val results = List(8) { async { fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER) } }.awaitAll()
            val shorter = fixture.provider.monthlySeries(YearMonth.of(2026, 1), SEPTEMBER)

            assertTrue((results + shorter).all { it is InflationSeriesResult.Success && !it.fromCache })
            assertEquals(1, fixture.availabilityRequests)
            assertEquals(listOf(AUGUST), fixture.monthlyEnds)
        }
    }

    @Test
    fun `newly published CPI is discovered after the hourly check expires`() = runBlocking {
        Fixture().use { fixture ->
            fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER)
            fixture.availableUntil = SEPTEMBER
            val beforeCheck = fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER) as InflationSeriesResult.Success
            assertEquals(AUGUST, beforeCheck.until)

            fixture.clock.advance(Duration.ofHours(1))
            val afterCheck = fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER) as InflationSeriesResult.Success

            assertEquals(SEPTEMBER, afterCheck.until)
            assertFalse(afterCheck.fromCache)
            assertEquals(2, fixture.availabilityRequests)
            assertEquals(listOf(AUGUST, SEPTEMBER), fixture.monthlyEnds)
            assertEquals("2026-08", fixture.cache.listSnapshots().single().sourceAsOf)
        }
    }

    @Test
    fun `provider outages preserve stale data and back off without multiplying failures`() = runBlocking {
        Fixture().use { fixture ->
            fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER)
            fixture.clock.advance(Duration.ofHours(1))
            fixture.unavailable = true

            repeat(8) {
                val result = fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER) as InflationSeriesResult.Success
                assertTrue(result.fromCache)
            }
            assertEquals(2, fixture.availabilityRequests)
            assertEquals(MarketDataSnapshotStatus.FAILED, fixture.cache.listSnapshots().single().status)
            assertEquals(1, fixture.cache.listSnapshots().single().failureCount)

            fixture.unavailable = false
            fixture.clock.advance(Duration.ofMinutes(5))
            val recovered = fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER) as InflationSeriesResult.Success
            assertFalse(recovered.fromCache)
            assertEquals(MarketDataSnapshotStatus.FRESH, fixture.cache.listSnapshots().single().status)
        }
    }

    @Test
    fun `an older coverage gap remains actionable instead of being called a publication delay`() = runBlocking {
        Fixture().use { fixture ->
            fixture.availableUntil = YearMonth.of(2026, 7)

            val result = fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER)

            assertTrue(result is InflationSeriesResult.Failure)
            assertEquals(MarketDataSnapshotStatus.FAILED, fixture.cache.listSnapshots().single().status)
            assertTrue(fixture.monthlyEnds.isEmpty())
        }
    }

    @Test
    fun `a portfolio starting in an unpublished month does not generate an operational failure`() = runBlocking {
        Fixture().use { fixture ->
            val result = fixture.provider.monthlySeries(AUGUST, SEPTEMBER)

            assertTrue(result is InflationSeriesResult.Failure)
            assertEquals(listOf(YearMonth.of(2026, 7)), fixture.availabilityStarts)
            assertTrue(fixture.monthlyEnds.isEmpty())
            assertTrue(fixture.cache.listSnapshots().isEmpty())
        }
    }

    @Test
    fun `explicit historical end is preserved when newer CPI is available`() = runBlocking {
        Fixture().use { fixture ->
            val requestedUntil = YearMonth.of(2026, 5)
            val result = fixture.provider.monthlySeries(NOVEMBER, requestedUntil) as InflationSeriesResult.Success
            assertEquals(requestedUntil, result.until)
            assertEquals(listOf(requestedUntil), fixture.monthlyEnds)
        }
    }

    @Test
    fun `a gap inside the confirmed published series remains a failure`() = runBlocking {
        Fixture().use { fixture ->
            fixture.omitLastPoint = true
            val result = fixture.provider.monthlySeries(NOVEMBER, SEPTEMBER)
            assertTrue(result is InflationSeriesResult.Failure)
            assertEquals(MarketDataSnapshotStatus.FAILED, fixture.cache.listSnapshots().single().status)
        }
    }

    private class Fixture : AutoCloseable {
        val clock = MutableClock(Instant.parse("2026-09-09T09:00:00Z"))
        private val json = AppJsonFactory.create()
        val cache = MarketDataSnapshotCacheService(
            OperationalStateService(InMemoryOperationalStateRepository(), json, clock), clock
        )
        var availableUntil = AUGUST
        var unavailable = false
        var omitLastPoint = false
        var availabilityRequests = 0
        val availabilityStarts = mutableListOf<YearMonth>()
        val monthlyEnds = mutableListOf<YearMonth>()
        private val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        private val client = HttpClient.newHttpClient()
        val provider: RemoteInflationAdjustmentProvider

        init {
            server.createContext("/v1/inflation/") { exchange ->
                val query = exchange.requestURI.query.split('&').associate {
                    it.substringBefore('=') to it.substringAfter('=').toInt()
                }
                val since = exchange.requestURI.path.endsWith("/since")
                val from = if (since) {
                    availabilityRequests++
                    YearMonth.of(query.getValue("year"), query.getValue("month")).also(availabilityStarts::add)
                } else {
                    YearMonth.of(query.getValue("startYear"), query.getValue("startMonth"))
                }
                val until = if (since) availableUntil else {
                    YearMonth.of(query.getValue("endYear"), query.getValue("endMonth")).also(monthlyEnds::add)
                }
                val body = when {
                    unavailable -> """{"error":"CPI provider unavailable","errorCode":"CPI_PROVIDER_UNAVAILABLE","retryable":true,"requestId":"test"}"""
                    since -> """{"from":"$from","until":"$until","multiplier":"1.02"}"""
                    else -> {
                        val pointsUntil = if (omitLastPoint) until.minusMonths(1) else until
                        val points = generateSequence(from) { it.plusMonths(1) }.takeWhile { it < pointsUntil }
                            .joinToString(",") { """{"month":"$it","multiplier":"1.001"}""" }
                        """{"from":"$from","until":"$until","points":[$points]}"""
                    }
                }
                val bytes = body.toByteArray()
                exchange.responseHeaders.set("Content-Type", "application/json")
                exchange.sendResponseHeaders(if (unavailable) 503 else 200, bytes.size.toLong())
                exchange.responseBody.use { it.write(bytes) }
            }
            server.start()
            provider = RemoteInflationAdjustmentProvider(
                MarketDataConfig.from(MapApplicationConfig(), env = { null }),
                EdoCalculatorClient(client, json, "http://127.0.0.1:${server.address.port}"),
                cache,
                clock
            )
        }

        override fun close() {
            server.stop(0)
            client.close()
        }
    }

    private class MutableClock(private var now: Instant) : Clock() {
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId): Clock = this
        override fun instant(): Instant = now
        fun advance(duration: Duration) { now = now.plus(duration) }
    }

    private companion object {
        val NOVEMBER: YearMonth = YearMonth.of(2025, 11)
        val AUGUST: YearMonth = YearMonth.of(2026, 8)
        val SEPTEMBER: YearMonth = YearMonth.of(2026, 9)
    }
}
