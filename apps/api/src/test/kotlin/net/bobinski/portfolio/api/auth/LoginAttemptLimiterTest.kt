package net.bobinski.portfolio.api.auth

import java.time.Instant
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class LoginAttemptLimiterTest {
    @Test
    fun `failed attempts use bounded exponential backoff and success resets state`() {
        var now = Instant.parse("2026-07-13T10:00:00Z")
        val limiter = LoginAttemptLimiter(now = { now })

        assertNull(limiter.recordFailure("client"))
        assertNull(limiter.recordFailure("client"))
        assertEquals(1, limiter.recordFailure("client"))
        assertEquals(1, limiter.retryAfterSeconds("client"))

        now = now.plusSeconds(1)
        assertNull(limiter.retryAfterSeconds("client"))
        assertEquals(2, limiter.recordFailure("client"))

        limiter.recordSuccess("client")
        assertNull(limiter.retryAfterSeconds("client"))
        assertNull(limiter.recordFailure("client"))
    }

    @Test
    fun `tracked transport peers are bounded`() {
        val limiter = LoginAttemptLimiter(maxEntries = 4)

        repeat(10) { index -> limiter.recordFailure("client-$index") }

        assertEquals(4, limiter.trackedClientCount())
    }
}
