package net.bobinski.portfolio.api.readmodel

import java.time.Clock
import net.bobinski.portfolio.api.monitoring.PortfolioMetrics
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import net.bobinski.portfolio.api.domain.repository.ReadModelCacheRepository
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelCacheDescriptorService
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.ReadModelCacheDescriptor
import net.bobinski.portfolio.api.domain.service.ReadModelCacheInvalidationReason
import net.bobinski.portfolio.api.domain.service.ReadModelCacheSnapshot
import net.bobinski.portfolio.api.domain.service.ReadModelComputationCoordinator
import net.bobinski.portfolio.api.route.PortfolioOverviewResponse
import net.bobinski.portfolio.api.route.ValuationSnapshotResponse
import net.bobinski.portfolio.api.route.toResponse
import org.slf4j.LoggerFactory

/** A persistent preview; the browser requests the live valuation after displaying it. */
class PortfolioOverviewSnapshotService(
    private val repository: ReadModelCacheRepository,
    private val json: Json,
    private val clock: Clock,
    private val coordinator: ReadModelComputationCoordinator,
    private val descriptor: suspend () -> ReadModelCacheDescriptor,
    private val compute: suspend () -> PortfolioOverviewResponse,
    private val marketDataEnabled: Boolean = true,
    private val metrics: PortfolioMetrics = PortfolioMetrics()
) {
    private val logger = LoggerFactory.getLogger(PortfolioOverviewSnapshotService::class.java)
    constructor(
        repository: ReadModelCacheRepository,
        json: Json,
        clock: Clock,
        coordinator: ReadModelComputationCoordinator,
        descriptors: PortfolioReadModelCacheDescriptorService,
        readModel: PortfolioReadModelService,
        marketDataEnabled: Boolean,
        metrics: PortfolioMetrics = PortfolioMetrics()
    ) : this(repository, json, clock, coordinator, descriptors::overviewDescriptor, {
        readModel.overview().toResponse()
    }, marketDataEnabled, metrics)

    // This is the fallback boundary for provider/computation failures; cancellation still propagates.
    @Suppress("TooGenericExceptionCaught")
    suspend fun overview(preferCached: Boolean = false): PortfolioOverviewResponse {
        val before = descriptor()
        val cached = compatibleSnapshot(before)
        if (preferCached && cached != null) {
            val refreshRequired = cached.snapshot.inputsTo != before.inputsTo ||
                cached.snapshot.sourceUpdatedAt != before.sourceUpdatedAt ||
                !cached.snapshot.generatedAt.plus(FRESH_FOR).isAfter(Instant.now(clock))
            return cached.response(refreshRequired = refreshRequired)
        }

        return coordinator.run(before.computationKey("overview-refresh")) {
            val result = try {
                compute()
            } catch (exception: CancellationException) {
                throw exception
            } catch (exception: Exception) {
                metrics.valuationFailed(Instant.now(clock))
                logger.warn("Unable to refresh the portfolio overview.", exception)
                requireSameInputs(before, descriptor())
                cached?.response(refreshFailed = true) ?: throw exception
            }
            val after = descriptor()
            requireSameInputs(before, after)

            metrics.observeValuation(result, isCompleteValuation(result), Instant.now(clock))
            if (!isCompleteValuation(result)) {
                cached?.response(refreshFailed = true) ?: result.withSnapshot(
                    generatedAt = Instant.now(clock), refreshFailed = true
                )
            } else {
                val generatedAt = Instant.now(clock)
                val payload = json.encodeToString(
                    StoredOverview.serializer(),
                    StoredOverview(after.parameters, result.copy(valuationSnapshot = null))
                )
                // One row per portfolio; ledger revisions must not accumulate snapshots.
                repository.save(
                    ReadModelCacheSnapshot(
                        cacheKey = after.cacheKey,
                        modelName = after.modelName,
                        modelVersion = after.modelVersion,
                        inputsFrom = after.inputsFrom,
                        inputsTo = after.inputsTo,
                        sourceUpdatedAt = after.sourceUpdatedAt,
                        generatedAt = generatedAt,
                        invalidationReason = if (cached == null) ReadModelCacheInvalidationReason.CACHE_MISS
                            else ReadModelCacheInvalidationReason.EXPLICIT_REFRESH,
                        payloadJson = payload,
                        payloadSizeBytes = payload.toByteArray(Charsets.UTF_8).size
                    )
                )
                result.withSnapshot(generatedAt)
            }
        }
    }

    private suspend fun compatibleSnapshot(current: ReadModelCacheDescriptor): CachedOverview? {
        val snapshot = repository.get(current.cacheKey) ?: return null
        if (snapshot.modelVersion != current.modelVersion || snapshot.modelName != current.modelName) return null
        val stored = try {
            json.decodeFromString(StoredOverview.serializer(), snapshot.payloadJson)
        } catch (_: IllegalArgumentException) {
            return null
        }
        if (stored.canonicalInputs != current.parameters || !isCompleteValuation(stored.overview)) return null
        return CachedOverview(snapshot, stored.overview)
    }

    private fun isCompleteValuation(result: PortfolioOverviewResponse): Boolean = with(result) {
        val marketValued = valuationState == "MARK_TO_MARKET" && valuationIssueCount == 0 &&
            activeHoldingCount == valuedHoldingCount
        (marketValued || (!marketDataEnabled && valuationState == "BOOK_ONLY")) &&
            missingFxTransactions == 0 && unsupportedCorrectionTransactions == 0 &&
            valuationSnapshot?.refreshFailed != true
    }

    private fun requireSameInputs(before: ReadModelCacheDescriptor, after: ReadModelCacheDescriptor) {
        check(before.modelVersion == after.modelVersion && before.parameters == after.parameters &&
            before.inputsFrom == after.inputsFrom && before.inputsTo == after.inputsTo) {
            "Portfolio changed while its valuation was being refreshed."
        }
    }

    private companion object {
        val FRESH_FOR: Duration = Duration.ofSeconds(60)
    }
}

@Serializable
private data class StoredOverview(
    val canonicalInputs: Map<String, String>,
    val overview: PortfolioOverviewResponse
)

private data class CachedOverview(val snapshot: ReadModelCacheSnapshot, val overview: PortfolioOverviewResponse) {
    fun response(refreshRequired: Boolean = false, refreshFailed: Boolean = false): PortfolioOverviewResponse =
        overview.copy(valuationSnapshot = ValuationSnapshotResponse(
            generatedAt = snapshot.generatedAt.toString(),
            fromCache = true,
            refreshRequired = refreshRequired,
            refreshFailed = refreshFailed
        ))
}

private fun PortfolioOverviewResponse.withSnapshot(
    generatedAt: Instant,
    refreshFailed: Boolean = false
): PortfolioOverviewResponse = copy(valuationSnapshot = ValuationSnapshotResponse(
    generatedAt = generatedAt.toString(),
    fromCache = false,
    refreshRequired = false,
    refreshFailed = refreshFailed
))
