package net.bobinski.portfolio.api.marketdata.service

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.marketdata.model.EdoSeriesCatalogResponse
import net.bobinski.portfolio.api.marketdata.model.EdoSeriesResponse
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import java.io.IOException
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

class EdoSeriesCatalogServiceTest {
    private val clock = MutableClock()
    private val catalog = EdoSeriesCatalogResponse("2026-11-02", listOf(
        EdoSeriesResponse("EDO1135", "2025-11", "2025-11-01", "2025-11-30", 575, 200,
            "https://www.obligacjeskarbowe.pl/", "2026-11-02")
    ))

    @Test
    fun `concurrent readers share one fetch until the hour expires`() = runBlocking {
        var requests = 0
        val service = EdoSeriesCatalogService({ requests++; delay(10); catalog }, clock)
        assertEquals(List(10) { catalog }, List(10) { async { service.catalog() } }.awaitAll())
        clock.advance(Duration.ofMinutes(59))
        assertEquals(catalog, service.catalog())
        assertEquals(1, requests)
        clock.advance(Duration.ofMinutes(1))
        service.catalog()
        assertEquals(2, requests)
    }

    @Test
    fun `outage keeps last good terms and recovery retries after one minute`() = runBlocking {
        var requests = 0
        var unavailable = false
        val service = EdoSeriesCatalogService({
            requests++
            if (unavailable) throw IOException("offline")
            catalog
        }, clock)
        assertFalse(service.catalog().stale)
        clock.advance(Duration.ofHours(1))
        unavailable = true
        val stale = service.catalog()
        assertTrue(stale.stale)
        assertEquals(catalog.series, stale.series)
        assertTrue(service.catalog().stale)
        assertEquals(2, requests)
        clock.advance(Duration.ofMinutes(1))
        unavailable = false
        assertFalse(service.catalog().stale)
        assertEquals(3, requests)
    }

    @Test
    fun `cold outage and disabled market data are explicit unavailable errors`() {
        assertThrows<EdoCatalogUnavailableException> {
            runBlocking { EdoSeriesCatalogService({ throw IOException("offline") }, clock).catalog() }
        }
        var fetched = false
        assertThrows<EdoCatalogUnavailableException> {
            runBlocking { EdoSeriesCatalogService({ fetched = true; catalog }, clock, enabled = false).catalog() }
        }
        assertFalse(fetched)
    }

    @Test
    fun `cancellation propagates instead of returning a stale catalog`() {
        var cancelled = false
        val service = EdoSeriesCatalogService({
            if (cancelled) throw CancellationException("cancelled")
            catalog
        }, clock)
        runBlocking { service.catalog() }
        clock.advance(Duration.ofHours(1))
        cancelled = true
        assertThrows<CancellationException> { runBlocking { service.catalog() } }
    }

    private class MutableClock : Clock() {
        private var now = Instant.parse("2026-11-02T12:00:00Z")
        override fun instant(): Instant = now
        override fun getZone(): ZoneId = ZoneOffset.UTC
        override fun withZone(zone: ZoneId): Clock = this
        fun advance(duration: Duration) { now = now.plus(duration) }
    }
}
