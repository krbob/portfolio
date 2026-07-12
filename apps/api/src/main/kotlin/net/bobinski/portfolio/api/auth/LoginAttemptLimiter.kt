package net.bobinski.portfolio.api.auth

import java.time.Duration
import java.time.Instant
import java.util.LinkedHashMap
import kotlin.math.min

internal class LoginAttemptLimiter(
    private val now: () -> Instant = Instant::now,
    private val maxEntries: Int = DEFAULT_MAX_ENTRIES
) {
    private val attempts = LinkedHashMap<String, AttemptState>(16, 0.75f, true)

    @Synchronized
    fun retryAfterSeconds(transportPeerKey: String): Long? {
        val observedAt = now()
        prune(observedAt)
        val blockedUntil = attempts[transportPeerKey]?.blockedUntil ?: return null
        return remainingSeconds(observedAt, blockedUntil).takeIf { it > 0 }
    }

    @Synchronized
    fun recordFailure(transportPeerKey: String): Long? {
        val observedAt = now()
        prune(observedAt)
        val previous = attempts[transportPeerKey]
        val consecutiveFailures = (previous?.consecutiveFailures ?: 0) + 1
        val delaySeconds = backoffSeconds(consecutiveFailures)
        if (previous == null) makeRoom()
        attempts[transportPeerKey] = AttemptState(
            consecutiveFailures = consecutiveFailures,
            blockedUntil = observedAt.plusSeconds(delaySeconds),
            lastFailureAt = observedAt
        )
        return delaySeconds.takeIf { it > 0 }
    }

    @Synchronized
    fun recordSuccess(transportPeerKey: String) {
        attempts.remove(transportPeerKey)
    }

    @Synchronized
    internal fun trackedClientCount(): Int = attempts.size

    private fun prune(observedAt: Instant) {
        attempts.entries.removeIf { (_, state) ->
            !observedAt.isBefore(state.lastFailureAt.plus(ENTRY_RETENTION))
        }
    }

    private fun makeRoom() {
        while (attempts.size >= maxEntries) {
            val eldest = attempts.entries.firstOrNull()?.key ?: return
            attempts.remove(eldest)
        }
    }

    private fun backoffSeconds(consecutiveFailures: Int): Long {
        if (consecutiveFailures < FAILURE_THRESHOLD) return 0
        val exponent = min(consecutiveFailures - FAILURE_THRESHOLD, MAX_BACKOFF_EXPONENT)
        return (BASE_BACKOFF_SECONDS shl exponent).coerceAtMost(MAX_BACKOFF_SECONDS)
    }

    private fun remainingSeconds(observedAt: Instant, blockedUntil: Instant): Long {
        val remainingMillis = Duration.between(observedAt, blockedUntil).toMillis()
        return if (remainingMillis <= 0) 0 else (remainingMillis + 999) / 1_000
    }

    private data class AttemptState(
        val consecutiveFailures: Int,
        val blockedUntil: Instant,
        val lastFailureAt: Instant
    )

    private companion object {
        const val DEFAULT_MAX_ENTRIES = 1_024
        const val FAILURE_THRESHOLD = 3
        const val BASE_BACKOFF_SECONDS = 1L
        const val MAX_BACKOFF_SECONDS = 60L
        const val MAX_BACKOFF_EXPONENT = 6
        val ENTRY_RETENTION: Duration = Duration.ofMinutes(15)
    }
}
