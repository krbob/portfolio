package net.bobinski.portfolio.api.readmodel

import java.time.Clock
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.repository.ReadModelCacheRepository
import net.bobinski.portfolio.api.domain.service.ReadModelCacheDescriptor
import net.bobinski.portfolio.api.domain.service.ReadModelCacheInvalidationReason
import net.bobinski.portfolio.api.domain.service.ReadModelCacheSnapshot
import net.bobinski.portfolio.api.domain.service.ReadModelComputationCoordinator
import org.slf4j.LoggerFactory

/** Persistent complete previews. The browser displays a preview before requesting a live refresh. */
class ReadModelSnapshotService(
    private val repository: ReadModelCacheRepository,
    private val json: Json,
    private val clock: Clock,
    private val coordinator: ReadModelComputationCoordinator
) {
    private val logger = LoggerFactory.getLogger(ReadModelSnapshotService::class.java)

    @Suppress("TooGenericExceptionCaught")
    suspend fun <T> read(
        preferCached: Boolean,
        serializer: KSerializer<T>,
        descriptor: suspend () -> ReadModelCacheDescriptor,
        compute: suspend () -> SnapshotCandidate<T>
    ): ReadModelSnapshot<T> {
        val before = descriptor()
        val cached = compatible(before, serializer)
        if (preferCached && cached != null) {
            val (snapshot, value) = cached
            return ReadModelSnapshot(value, snapshot.generatedAt, true,
                snapshot.inputsTo != before.inputsTo || snapshot.sourceUpdatedAt != before.sourceUpdatedAt ||
                    !snapshot.generatedAt.plus(FRESH_FOR).isAfter(Instant.now(clock)))
        }
        return coordinator.run(before.computationKey("preview-refresh")) {
            val candidate = try {
                compute()
            } catch (exception: CancellationException) {
                throw exception
            } catch (exception: Exception) {
                requireSameInputs(before, descriptor())
                logger.warn("Unable to refresh {}.", before.modelName, exception)
                return@run cached?.let { (snapshot, value) ->
                    ReadModelSnapshot(value, snapshot.generatedAt, true, refreshFailed = true)
                } ?: throw exception
            }
            val after = descriptor()
            requireSameInputs(before, after)
            if (!candidate.complete) {
                return@run cached?.let { (snapshot, value) ->
                    ReadModelSnapshot(value, snapshot.generatedAt, true, refreshFailed = true)
                } ?: ReadModelSnapshot(candidate.value, Instant.now(clock), false, refreshFailed = true)
            }
            val generatedAt = Instant.now(clock)
            val payload = json.encodeToString(StoredReadModel.serializer(serializer),
                StoredReadModel(after.parameters, candidate.value))
            repository.save(ReadModelCacheSnapshot(
                cacheKey = after.cacheKey, modelName = after.modelName, modelVersion = after.modelVersion,
                inputsFrom = after.inputsFrom, inputsTo = after.inputsTo, sourceUpdatedAt = after.sourceUpdatedAt,
                generatedAt = generatedAt, invalidationReason = ReadModelCacheInvalidationReason.EXPLICIT_REFRESH,
                payloadJson = payload, payloadSizeBytes = payload.toByteArray(Charsets.UTF_8).size
            ))
            ReadModelSnapshot(candidate.value, generatedAt, false)
        }
    }

    private suspend fun <T> compatible(current: ReadModelCacheDescriptor, serializer: KSerializer<T>): Pair<ReadModelCacheSnapshot, T>? {
        val snapshot = repository.get(current.cacheKey) ?: return null
        if (snapshot.modelVersion != current.modelVersion || snapshot.modelName != current.modelName) return null
        val stored = try {
            json.decodeFromString(StoredReadModel.serializer(serializer), snapshot.payloadJson)
        } catch (_: IllegalArgumentException) { return null }
        if (stored.canonicalInputs != current.parameters || snapshot.inputsFrom != current.inputsFrom) return null
        return snapshot to stored.value
    }

    private fun requireSameInputs(before: ReadModelCacheDescriptor, after: ReadModelCacheDescriptor) {
        check(before.modelVersion == after.modelVersion && before.parameters == after.parameters &&
            before.inputsFrom == after.inputsFrom && before.inputsTo == after.inputsTo) {
            "Portfolio changed while ${before.modelName} was being refreshed."
        }
    }

    private companion object { val FRESH_FOR: Duration = Duration.ofSeconds(60) }
}

data class SnapshotCandidate<T>(val value: T, val complete: Boolean = true)
data class ReadModelSnapshot<T>(
    val value: T, val generatedAt: Instant, val fromCache: Boolean,
    val refreshRequired: Boolean = false, val refreshFailed: Boolean = false
)

@Serializable
private data class StoredReadModel<T>(val canonicalInputs: Map<String, String>, val value: T)
