package net.bobinski.portfolio.api.domain.service

import java.time.Instant
import java.time.LocalDate
import java.util.LinkedHashMap
import kotlinx.coroutines.CoroutineName
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.cancel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

class ReadModelComputationCoordinator : AutoCloseable {
    private val scope = CoroutineScope(
        SupervisorJob() + Dispatchers.Default + CoroutineName("portfolio-read-model-single-flight")
    )
    private val mutex = Mutex()
    private val inFlight = mutableMapOf<ReadModelFlightKey, ActiveComputation>()
    private val completed = object : LinkedHashMap<ReadModelComputationSlot, CompletedComputation>(
        MAX_COMPLETED_SNAPSHOTS + 1,
        LOAD_FACTOR,
        true
    ) {
        override fun removeEldestEntry(
            eldest: MutableMap.MutableEntry<ReadModelComputationSlot, CompletedComputation>?
        ): Boolean = size > MAX_COMPLETED_SNAPSHOTS
    }

    suspend fun <T> run(
        key: ReadModelComputationKey,
        compute: suspend () -> T
    ): T = execute(key = key, reuseCompleted = false, cacheSuccess = false, compute = compute)

    suspend fun <T> getOrCompute(
        key: ReadModelComputationKey,
        compute: suspend () -> T
    ): T = execute(key = key, reuseCompleted = true, cacheSuccess = true, compute = compute)

    suspend fun <T> refresh(
        key: ReadModelComputationKey,
        compute: suspend () -> T
    ): T = execute(key = key, reuseCompleted = false, cacheSuccess = true, compute = compute)

    suspend fun clearCompleted() {
        mutex.withLock {
            completed.clear()
        }
    }

    private suspend fun <T> execute(
        key: ReadModelComputationKey,
        reuseCompleted: Boolean,
        cacheSuccess: Boolean,
        compute: suspend () -> T
    ): T {
        val flightKey = key.flightKey()
        val deferred = mutex.withLock {
            if (reuseCompleted) {
                completed[key.slot()]?.takeIf { entry -> entry.key == key }?.let { entry ->
                    @Suppress("UNCHECKED_CAST")
                    return entry.value as T
                }
            }
            inFlight[flightKey]?.deferred ?: createComputation(
                key = key,
                flightKey = flightKey,
                cacheSuccess = cacheSuccess,
                compute = compute
            )
        }

        @Suppress("UNCHECKED_CAST")
        return deferred.await() as T
    }

    override fun close() {
        scope.cancel("Read-model computation coordinator closed.")
    }

    private fun <T> createComputation(
        key: ReadModelComputationKey,
        flightKey: ReadModelFlightKey,
        cacheSuccess: Boolean,
        compute: suspend () -> T
    ): Deferred<Any?> {
        val token = Any()
        val deferred = scope.async(start = CoroutineStart.LAZY) {
            var succeeded = false
            var computed: Any? = null
            try {
                computed = compute()
                succeeded = true
                computed
            } finally {
                withContext(NonCancellable) {
                    mutex.withLock {
                        if (succeeded && cacheSuccess) {
                            completed[key.slot()] = CompletedComputation(key = key, value = computed)
                        }
                        if (inFlight[flightKey]?.token === token) {
                            inFlight.remove(flightKey)
                        }
                    }
                }
            }
        }
        inFlight[flightKey] = ActiveComputation(token = token, deferred = deferred)
        deferred.start()
        return deferred
    }

    private companion object {
        const val MAX_COMPLETED_SNAPSHOTS = 32
        const val LOAD_FACTOR = 0.75f
    }
}

data class ReadModelComputationKey(
    val computation: String,
    val modelKey: String,
    val modelVersion: Int,
    val canonicalRevision: Instant?,
    val sourceRevision: Instant?,
    val inputsFrom: LocalDate?,
    val inputsTo: LocalDate?,
    val parameters: Map<String, String>
) {
    private fun normalizedParameters(): Map<String, String> = parameters.toSortedMap()

    internal fun slot(): ReadModelComputationSlot = ReadModelComputationSlot(
        computation = computation,
        modelKey = modelKey,
        parameters = normalizedParameters()
    )

    internal fun flightKey(): ReadModelFlightKey = ReadModelFlightKey(
        computation = computation,
        modelKey = modelKey,
        modelVersion = modelVersion,
        canonicalRevision = canonicalRevision,
        inputsFrom = inputsFrom,
        inputsTo = inputsTo,
        parameters = normalizedParameters()
    )
}

internal data class ReadModelFlightKey(
    val computation: String,
    val modelKey: String,
    val modelVersion: Int,
    val canonicalRevision: Instant?,
    val inputsFrom: LocalDate?,
    val inputsTo: LocalDate?,
    val parameters: Map<String, String>
)

internal data class ReadModelComputationSlot(
    val computation: String,
    val modelKey: String,
    val parameters: Map<String, String>
)

private data class ActiveComputation(
    val token: Any,
    val deferred: Deferred<Any?>
)

private data class CompletedComputation(
    val key: ReadModelComputationKey,
    val value: Any?
)
