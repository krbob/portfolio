package net.bobinski.portfolio.api.marketdata.service

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import net.bobinski.portfolio.api.marketdata.model.EdoSeriesCatalogResponse
import org.slf4j.LoggerFactory
import java.time.Clock
import java.time.Duration
import java.time.Instant

class EdoSeriesCatalogService(
    private val fetchCatalog: suspend () -> EdoSeriesCatalogResponse,
    private val clock: Clock,
    private val enabled: Boolean = true
) {
    private data class Entry(val catalog: EdoSeriesCatalogResponse, val expiresAt: Instant)
    private val mutex = Mutex()
    private val logger = LoggerFactory.getLogger(javaClass)
    private var entry: Entry? = null

    // Transport, decoding and validation failures all retain the last good catalog.
    // Cancellation must still propagate to the caller.
    @Suppress("TooGenericExceptionCaught")
    suspend fun catalog(): EdoSeriesCatalogResponse = mutex.withLock {
        if (!enabled) throw EdoCatalogUnavailableException(IllegalStateException("Market data is disabled."))
        val previous = entry
        if (previous != null && clock.instant().isBefore(previous.expiresAt)) return@withLock previous.catalog
        try {
            val catalog = fetchCatalog().copy(stale = false)
            entry = Entry(catalog, clock.instant().plus(Duration.ofHours(1)))
            catalog
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            logger.warn("EDO emission catalog refresh failed: {}", exception.message)
            if (previous == null) throw EdoCatalogUnavailableException(exception)
            val fallback = previous.catalog.copy(stale = true)
            entry = Entry(fallback, clock.instant().plus(Duration.ofMinutes(1)))
            fallback
        }
    }
}

class EdoCatalogUnavailableException(cause: Exception) : RuntimeException("EDO emission catalog is unavailable.", cause)
