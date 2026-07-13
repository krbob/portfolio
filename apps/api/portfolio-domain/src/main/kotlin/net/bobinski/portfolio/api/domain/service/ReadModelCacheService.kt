package net.bobinski.portfolio.api.domain.service

import java.security.MessageDigest
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.repository.ReadModelCacheRepository

class ReadModelCacheService(
    private val repository: ReadModelCacheRepository,
    private val json: Json,
    private val clock: Clock,
    private val computationCoordinator: ReadModelComputationCoordinator = ReadModelComputationCoordinator()
) {
    suspend fun <T> getOrCompute(
        descriptor: ReadModelCacheDescriptor,
        serializer: KSerializer<T>,
        compute: suspend () -> T
    ): T {
        val cached = repository.get(descriptor.storageKey())
        if (cached != null && cached.matches(descriptor)) {
            try {
                return json.decodeFromString(serializer, cached.payloadJson)
            } catch (exception: CancellationException) {
                throw exception
            } catch (_: Exception) {
                // Recheck and rebuild under the same single-flight as every other miss.
            }
        }

        return computationCoordinator.run(descriptor.computationKey(PERSISTENT_COMPUTATION)) {
            val latest = repository.get(descriptor.storageKey())
            if (latest != null && latest.matches(descriptor)) {
                try {
                    return@run json.decodeFromString(serializer, latest.payloadJson)
                } catch (exception: CancellationException) {
                    throw exception
                } catch (_: Exception) {
                    return@run rebuild(
                        descriptor = descriptor,
                        serializer = serializer,
                        invalidationReason = ReadModelCacheInvalidationReason.PAYLOAD_DECODE_FAILED,
                        compute = compute
                    )
                }
            }
            rebuild(
                descriptor = descriptor,
                serializer = serializer,
                invalidationReason = latest?.invalidationReasonFor(descriptor)
                    ?: ReadModelCacheInvalidationReason.CACHE_MISS,
                compute = compute
            )
        }
    }

    suspend fun <T> getOrComputeStaleIfError(
        descriptor: ReadModelCacheDescriptor,
        serializer: KSerializer<T>,
        descriptorAfterCompute: suspend () -> ReadModelCacheDescriptor = { descriptor },
        isAcceptable: (T) -> Boolean = { true },
        shouldPersist: (T) -> Boolean = isAcceptable,
        compute: suspend () -> T
    ): T {
        val cached = repository.get(descriptor.storageKey())
        val cachedValue = cached
            ?.takeIf { snapshot -> snapshot.isCompatibleStaleFallbackFor(descriptor) }
            ?.decodeAcceptableOrNull(serializer, isAcceptable)
        if (cached != null && cached.matches(descriptor) && cachedValue != null) {
            return cachedValue
        }

        val attempted = runCatching {
            computeStaleCandidate(
                descriptor = descriptor,
                serializer = serializer,
                descriptorAfterCompute = descriptorAfterCompute,
                isAcceptable = isAcceptable,
                shouldPersist = shouldPersist,
                compute = compute
            )
        }
        if (attempted.isSuccess) {
            return attempted.getOrThrow()
        }

        val failure = checkNotNull(attempted.exceptionOrNull())
        if (failure is CancellationException || failure !is Exception) {
            throw failure
        }
        return latestAcceptableOrNull(
            descriptor = descriptor,
            serializer = serializer,
            isAcceptable = isAcceptable
        ) ?: cachedValue ?: throw failure
    }

    suspend fun <T> forceRefresh(
        descriptor: ReadModelCacheDescriptor,
        serializer: KSerializer<T>,
        compute: suspend () -> T
    ): T = computationCoordinator.run(descriptor.computationKey(PERSISTENT_COMPUTATION)) {
        rebuild(
            descriptor = descriptor,
            serializer = serializer,
            invalidationReason = ReadModelCacheInvalidationReason.EXPLICIT_REFRESH,
            compute = compute
        )
    }

    suspend fun list(): List<ReadModelCacheSnapshot> = repository.list()
        .sortedByDescending(ReadModelCacheSnapshot::generatedAt)

    suspend fun clearAll(): Int {
        val cleared = repository.clearAll()
        computationCoordinator.clearCompleted()
        return cleared
    }

    private suspend fun <T> rebuild(
        descriptor: ReadModelCacheDescriptor,
        serializer: KSerializer<T>,
        invalidationReason: ReadModelCacheInvalidationReason,
        compute: suspend () -> T
    ): T {
        val value = compute()
        persist(
            descriptor = descriptor,
            serializer = serializer,
            value = value,
            invalidationReason = invalidationReason
        )
        return value
    }

    private suspend fun <T> computeStaleCandidate(
        descriptor: ReadModelCacheDescriptor,
        serializer: KSerializer<T>,
        descriptorAfterCompute: suspend () -> ReadModelCacheDescriptor,
        isAcceptable: (T) -> Boolean,
        shouldPersist: (T) -> Boolean,
        compute: suspend () -> T
    ): T = computationCoordinator.run(descriptor.computationKey(PERSISTENT_COMPUTATION)) {
        val latest = repository.get(descriptor.storageKey())
        val latestValue = latest
            ?.takeIf { snapshot -> snapshot.isCompatibleStaleFallbackFor(descriptor) }
            ?.decodeAcceptableOrNull(serializer, isAcceptable)
        if (latest != null && latest.matches(descriptor) && latestValue != null) {
            return@run latestValue
        }

        val value = compute()
        if (!shouldPersist(value)) {
            return@run latestValue ?: value
        }
        val refreshedDescriptor = descriptorAfterCompute()
        descriptor.requireSameCanonicalInputs(refreshedDescriptor)
        persist(
            descriptor = refreshedDescriptor,
            serializer = serializer,
            value = value,
            invalidationReason = latest?.invalidationReasonFor(refreshedDescriptor)
                ?: ReadModelCacheInvalidationReason.CACHE_MISS
        )
        value
    }

    private suspend fun <T> persist(
        descriptor: ReadModelCacheDescriptor,
        serializer: KSerializer<T>,
        value: T,
        invalidationReason: ReadModelCacheInvalidationReason
    ) {
        val payloadJson = json.encodeToString(serializer, value)
        repository.save(
            ReadModelCacheSnapshot(
                cacheKey = descriptor.storageKey(),
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
    }

    private fun <T> ReadModelCacheSnapshot.decodeAcceptableOrNull(
        serializer: KSerializer<T>,
        isAcceptable: (T) -> Boolean
    ): T? = try {
        json.decodeFromString(serializer, payloadJson).takeIf(isAcceptable)
    } catch (exception: CancellationException) {
        throw exception
    } catch (_: Exception) {
        null
    }

    private suspend fun <T> latestAcceptableOrNull(
        descriptor: ReadModelCacheDescriptor,
        serializer: KSerializer<T>,
        isAcceptable: (T) -> Boolean
    ): T? = try {
        repository.get(descriptor.storageKey())
            ?.takeIf { snapshot -> snapshot.isCompatibleStaleFallbackFor(descriptor) }
            ?.decodeAcceptableOrNull(serializer, isAcceptable)
    } catch (exception: CancellationException) {
        throw exception
    } catch (_: Exception) {
        null
    }

    private companion object {
        const val PERSISTENT_COMPUTATION = "persistent:read-model"
    }
}

private fun ReadModelCacheDescriptor.requireSameCanonicalInputs(refreshed: ReadModelCacheDescriptor) {
    check(
        cacheKey == refreshed.cacheKey &&
            modelName == refreshed.modelName &&
            modelVersion == refreshed.modelVersion &&
            inputsFrom == refreshed.inputsFrom &&
            inputsTo == refreshed.inputsTo &&
            canonicalRevision == refreshed.canonicalRevision &&
            parameters == refreshed.parameters
    ) {
        "Canonical read-model inputs changed while ${modelName} was being computed."
    }
}

data class ReadModelCacheDescriptor(
    val cacheKey: String,
    val modelName: String,
    val modelVersion: Int,
    val inputsFrom: LocalDate?,
    val inputsTo: LocalDate?,
    val sourceUpdatedAt: Instant?,
    val canonicalRevision: Instant? = sourceUpdatedAt,
    val parameters: Map<String, String> = emptyMap()
) {
    fun computationKey(computation: String): ReadModelComputationKey = ReadModelComputationKey(
        computation = computation,
        modelKey = cacheKey,
        modelVersion = modelVersion,
        canonicalRevision = canonicalRevision,
        sourceRevision = sourceUpdatedAt,
        inputsFrom = inputsFrom,
        inputsTo = inputsTo,
        parameters = parameters.toSortedMap()
    )

    fun storageKey(): String = if (parameters.isEmpty()) {
        cacheKey
    } else {
        "$cacheKey.${parameters.canonicalFingerprintInput().sha256Hex()}"
    }
}

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
    fun isCompatibleStaleFallbackFor(descriptor: ReadModelCacheDescriptor): Boolean =
        cacheKey == descriptor.storageKey() &&
            modelName == descriptor.modelName &&
            modelVersion == descriptor.modelVersion &&
            inputsFrom == descriptor.inputsFrom &&
            inputsTo == descriptor.inputsTo &&
            (
                descriptor.canonicalRevision == null ||
                    (sourceUpdatedAt != null && !descriptor.canonicalRevision.isAfter(sourceUpdatedAt))
                )

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
    PAYLOAD_DECODE_FAILED,
    EXPLICIT_REFRESH
}

private fun String.sha256Hex(): String = MessageDigest.getInstance("SHA-256")
    .digest(toByteArray(Charsets.UTF_8))
    .joinToString(separator = "") { byte -> "%02x".format(byte) }

private fun Map<String, String>.canonicalFingerprintInput(): String =
    toSortedMap().entries.joinToString(separator = "") { (key, value) ->
        "${key.length}:$key${value.length}:$value"
    }
