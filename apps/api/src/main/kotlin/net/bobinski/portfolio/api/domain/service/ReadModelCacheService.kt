package net.bobinski.portfolio.api.domain.service

import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.repository.ReadModelCacheRepository

class ReadModelCacheService(
    private val repository: ReadModelCacheRepository,
    private val json: Json,
    private val clock: Clock
) {
    suspend fun <T> getOrCompute(
        descriptor: ReadModelCacheDescriptor,
        serializer: KSerializer<T>,
        compute: suspend () -> T
    ): T {
        val cached = repository.get(descriptor.cacheKey)
        if (cached != null && cached.matches(descriptor)) {
            try {
                return json.decodeFromString(serializer, cached.payloadJson)
            } catch (_: Exception) {
                return rebuild(
                    descriptor = descriptor,
                    serializer = serializer,
                    invalidationReason = ReadModelCacheInvalidationReason.PAYLOAD_DECODE_FAILED,
                    compute = compute
                )
            }
        }

        return rebuild(
            descriptor = descriptor,
            serializer = serializer,
            invalidationReason = cached?.invalidationReasonFor(descriptor) ?: ReadModelCacheInvalidationReason.CACHE_MISS,
            compute = compute
        )
    }

    suspend fun list(): List<ReadModelCacheSnapshot> = repository.list()
        .sortedByDescending(ReadModelCacheSnapshot::generatedAt)

    private suspend fun <T> rebuild(
        descriptor: ReadModelCacheDescriptor,
        serializer: KSerializer<T>,
        invalidationReason: ReadModelCacheInvalidationReason,
        compute: suspend () -> T
    ): T {
        val value = compute()
        val payloadJson = json.encodeToString(serializer, value)
        repository.save(
            ReadModelCacheSnapshot(
                cacheKey = descriptor.cacheKey,
                modelName = descriptor.modelName,
                modelVersion = descriptor.modelVersion,
                inputsFrom = descriptor.inputsFrom,
                inputsTo = descriptor.inputsTo,
                sourceUpdatedAt = descriptor.sourceUpdatedAt,
                generatedAt = Instant.now(clock),
                invalidationReason = invalidationReason,
                payloadJson = payloadJson,
                payloadSizeBytes = payloadJson.toByteArray(Charsets.UTF_8).size
            )
        )
        return value
    }
}

data class ReadModelCacheDescriptor(
    val cacheKey: String,
    val modelName: String,
    val modelVersion: Int,
    val inputsFrom: LocalDate?,
    val inputsTo: LocalDate?,
    val sourceUpdatedAt: Instant?
)

data class ReadModelCacheSnapshot(
    val cacheKey: String,
    val modelName: String,
    val modelVersion: Int,
    val inputsFrom: LocalDate?,
    val inputsTo: LocalDate?,
    val sourceUpdatedAt: Instant?,
    val generatedAt: Instant,
    val invalidationReason: ReadModelCacheInvalidationReason,
    val payloadJson: String,
    val payloadSizeBytes: Int
) {
    fun matches(descriptor: ReadModelCacheDescriptor): Boolean =
        invalidationReasonFor(descriptor) == null

    fun invalidationReasonFor(descriptor: ReadModelCacheDescriptor): ReadModelCacheInvalidationReason? = when {
        modelVersion != descriptor.modelVersion -> ReadModelCacheInvalidationReason.MODEL_VERSION_CHANGED
        inputsFrom != descriptor.inputsFrom || inputsTo != descriptor.inputsTo -> ReadModelCacheInvalidationReason.INPUT_WINDOW_CHANGED
        sourceUpdatedAt != descriptor.sourceUpdatedAt -> ReadModelCacheInvalidationReason.CANONICAL_STATE_CHANGED
        else -> null
    }
}

enum class ReadModelCacheInvalidationReason {
    CACHE_MISS,
    MODEL_VERSION_CHANGED,
    INPUT_WINDOW_CHANGED,
    CANONICAL_STATE_CHANGED,
    PAYLOAD_DECODE_FAILED
}
