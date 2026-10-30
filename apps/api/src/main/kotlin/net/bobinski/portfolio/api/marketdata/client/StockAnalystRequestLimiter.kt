package net.bobinski.portfolio.api.marketdata.client

import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import net.bobinski.portfolio.api.marketdata.service.CurrentValuationContext

/** Reserves one slot for current valuation without increasing the shared upstream concurrency limit. */
class StockAnalystRequestLimiter(maxConcurrentRequests: Int = 2) {
    private val allRequests = Semaphore(maxConcurrentRequests)
    private val analyticsRequests = Semaphore(maxOf(1, maxConcurrentRequests - 1))

    suspend fun <T> withPermit(block: suspend () -> T): T =
        if (currentCoroutineContext()[CurrentValuationContext.Key] != null) {
            allRequests.withPermit { block() }
        } else {
            // Wait for analytics admission before taking any of the shared capacity.
            analyticsRequests.withPermit { allRequests.withPermit { block() } }
        }
}
