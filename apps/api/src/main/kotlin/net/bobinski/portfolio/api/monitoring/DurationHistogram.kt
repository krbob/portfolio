package net.bobinski.portfolio.api.monitoring

import java.util.Locale

/** A bounded, coherent histogram snapshot, including exact 5 s and 20 s alert thresholds. */
internal class DurationHistogram {
    private val buckets = LongArray(BOUNDS.size)
    private var observations = 0L
    private var nanos = 0.0

    @Synchronized fun record(durationNanos: Long) {
        val duration = durationNanos.coerceAtLeast(0)
        observations++
        nanos += duration
        BOUNDS.forEachIndexed { index, bound ->
            if (duration <= bound * NANOS_PER_SECOND) buckets[index]++
        }
    }

    @Synchronized fun count(): Long = observations

    @Synchronized fun scrape(name: String, labels: String): String = buildString {
        val prefix = if (labels.isEmpty()) "" else "$labels,"
        BOUNDS.forEachIndexed { index, bound ->
            appendLine("${name}_bucket{${prefix}le=\"${bound}\"} ${buckets[index]}")
        }
        appendLine("${name}_bucket{${prefix}le=\"+Inf\"} $observations")
        sample("${name}_count", observations, labels)
        val suffix = if (labels.isEmpty()) "" else "{$labels}"
        appendLine("${name}_sum$suffix ${String.format(Locale.ROOT, "%.9f", nanos / NANOS_PER_SECOND)}")
    }

    private companion object {
        const val NANOS_PER_SECOND = 1_000_000_000.0
        val BOUNDS = doubleArrayOf(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0, 60.0)
    }
}
