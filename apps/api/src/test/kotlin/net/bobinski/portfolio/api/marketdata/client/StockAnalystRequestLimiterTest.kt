package net.bobinski.portfolio.api.marketdata.client

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import net.bobinski.portfolio.api.marketdata.service.CurrentValuationContext
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class StockAnalystRequestLimiterTest {
    @Test
    fun `queued analytics leave a slot for valuation at each supported capacity`() = runBlocking {
        withTimeout(5_000) {
            for (limit in listOf(2, 4)) {
                val limiter = StockAnalystRequestLimiter(limit)
                val release = CompletableDeferred<Unit>()
                var entered = 0
                val analytics = List(limit + 2) {
                    async(start = CoroutineStart.UNDISPATCHED) {
                        limiter.withPermit {
                            entered++
                            release.await()
                        }
                    }
                }
                assertEquals(limit - 1, entered)
                assertEquals("valuation", withContext(CurrentValuationContext) {
                    limiter.withPermit { "valuation" }
                })
                assertEquals(limit - 1, entered)
                release.complete(Unit)
                analytics.awaitAll()
                assertEquals(limit + 2, entered)
            }
        }
    }

    @Test
    fun `valuation uses both slots and analytics waiting for shared capacity can be cancelled`() = runBlocking {
        withTimeout(5_000) {
            val limiter = StockAnalystRequestLimiter()
            val release = CompletableDeferred<Unit>()
            var entered = 0
            val valuations = List(2) {
                async(CurrentValuationContext, start = CoroutineStart.UNDISPATCHED) {
                    limiter.withPermit {
                        entered++
                        release.await()
                    }
                }
            }
            assertEquals(2, entered)
            val analytics = async(start = CoroutineStart.UNDISPATCHED) {
                limiter.withPermit { error("Shared capacity was exceeded") }
            }
            assertFalse(analytics.isCompleted)
            analytics.cancelAndJoin()
            release.complete(Unit)
            valuations.awaitAll()
            assertEquals("analytics", limiter.withPermit { "analytics" })
        }
    }

    @Test
    fun `cancelling running and queued requests releases both admission permits`() = runBlocking {
        withTimeout(5_000) {
            val limiter = StockAnalystRequestLimiter()
            val running = async(start = CoroutineStart.UNDISPATCHED) {
                limiter.withPermit { awaitCancellation() }
            }
            val queued = async(start = CoroutineStart.UNDISPATCHED) {
                limiter.withPermit { error("Analytics reservation was exceeded") }
            }
            queued.cancelAndJoin()
            running.cancelAndJoin()
            assertEquals("analytics", limiter.withPermit { "analytics" })
            // Nested permits deliberately hold both slots to detect a leaked total permit.
            withContext(CurrentValuationContext) {
                limiter.withPermit { limiter.withPermit { Unit } }
            }
        }
    }

    @Test
    fun `failed request releases analytics admission and shared capacity`() = runBlocking {
        withTimeout(5_000) {
            val limiter = StockAnalystRequestLimiter()
            val failure = runCatching { limiter.withPermit { error("upstream failed") } }
            assertTrue(failure.exceptionOrNull() is IllegalStateException)
            assertEquals("analytics", limiter.withPermit { "analytics" })
            withContext(CurrentValuationContext) {
                limiter.withPermit { limiter.withPermit { Unit } }
            }
        }
    }

    @Test
    fun `limit one serializes valuation and analytics without deadlocking`() = runBlocking {
        withTimeout(5_000) {
            val limiter = StockAnalystRequestLimiter(1)
            val release = CompletableDeferred<Unit>()
            val analytics = async(start = CoroutineStart.UNDISPATCHED) {
                limiter.withPermit { release.await() }
            }
            val valuation = async(CurrentValuationContext, start = CoroutineStart.UNDISPATCHED) {
                limiter.withPermit { "valuation" }
            }
            assertFalse(valuation.isCompleted)
            release.complete(Unit)
            analytics.await()
            assertEquals("valuation", valuation.await())
        }
    }
}
