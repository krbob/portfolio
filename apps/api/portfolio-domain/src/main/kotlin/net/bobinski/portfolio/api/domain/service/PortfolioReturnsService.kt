package net.bobinski.portfolio.api.domain.service

import kotlin.math.pow
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesResult
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Clock
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.ChronoUnit
import java.util.TreeMap

class PortfolioReturnsService(
    private val transactionRepository: TransactionRepository,
    private val portfolioHistoryService: PortfolioHistoryService,
    private val transactionFxConversionService: TransactionFxConversionService,
    private val referenceSeriesProvider: ReferenceSeriesProvider,
    private val inflationAdjustmentProvider: InflationAdjustmentProvider,
    private val benchmarkSettingsService: PortfolioBenchmarkSettingsService,
    private val clock: Clock,
    private val cacheDescriptorService: PortfolioReadModelCacheDescriptorService? = null,
    private val computationCoordinator: ReadModelComputationCoordinator? = null
) {
    private val inflationSupport = PortfolioInflationSupport(inflationAdjustmentProvider)

    suspend fun returns(): PortfolioReturns {
        val coordinator = computationCoordinator
            ?: return computeReturns(portfolioHistoryService.dailyHistory())
        val descriptor = cacheDescriptorService?.returnsDescriptor()
            ?: return computeReturns(portfolioHistoryService.dailyHistory())
        return coordinator.getOrCompute(descriptor.computationKey("domain:returns")) {
            computeReturns(portfolioHistoryService.dailyHistory())
        }
    }

    suspend fun returns(history: PortfolioDailyHistory): PortfolioReturns {
        val coordinator = computationCoordinator ?: return computeReturns(history)
        val descriptor = cacheDescriptorService?.returnsDescriptor()
            ?: return computeReturns(history)
        return coordinator.refresh(descriptor.computationKey("domain:returns")) {
            computeReturns(history)
        }
    }

    private suspend fun computeReturns(history: PortfolioDailyHistory): PortfolioReturns {
        val today = LocalDate.now(clock)

        if (history.points.isEmpty()) {
            return PortfolioReturns(
                asOf = today,
                periods = emptyList(),
                rollingReturns = emptyList(),
                drawdowns = PortfolioDrawdowns(
                    current = null,
                    max = null,
                    observations = emptyList(),
                    episodes = emptyList()
                )
            )
        }

        val transactions = transactionRepository.list()
            .sortedWith(TransactionLedger.order)
        val externalTransactions = transactions.filter { it.type == TransactionType.DEPOSIT || it.type == TransactionType.WITHDRAWAL }
        val fxLookups = transactionFxConversionService.loadLookups(transactions)
        val usdPlnLookup = loadUsdPlnLookup(from = history.from, to = history.until)
        val externalCashFlows = externalTransactions.map { transaction ->
            ExternalCashFlow(
                date = transaction.tradeDate,
                plnAmount = transaction.toSignedPlnAmountOrNull(fxLookups),
                usdAmount = transaction.toSignedUsdAmountOrNull(fxLookups, usdPlnLookup)
            )
        }
        val inception = history.from
        val benchmarkSettings = benchmarkSettingsService.settings()
        val periods = coroutineScope {
            ReturnPeriodDefinition.entries
                .map { definition ->
                    async {
                        val requestedFrom = definition.requestedFrom(today = history.until)
                        val effectiveFrom = maxOf(requestedFrom, inception)
                        buildPeriod(
                            PeriodBuildInput(
                                window = ReturnPeriodWindow(
                                    definition = definition,
                                    requestedFrom = requestedFrom,
                                    effectiveFrom = effectiveFrom
                                ),
                                history = history,
                                transactions = transactions,
                                fxLookups = fxLookups,
                                externalCashFlows = externalCashFlows,
                                benchmarkSettings = benchmarkSettings
                            )
                        )
                    }
                }
                .awaitAll()
        }

        return PortfolioReturns(
            asOf = history.until,
            periods = periods,
            rollingReturns = buildRollingReturns(history),
            drawdowns = buildDrawdowns(history)
        )
    }

    private suspend fun buildPeriod(input: PeriodBuildInput): PortfolioReturnPeriod {
        val plnValues = input.history.points.map { point ->
            ValuationPoint(date = point.date, value = point.totalCurrentValuePln)
        }
        val plnCashFlows = input.externalCashFlows.mapNotNull { cashFlow ->
            cashFlow.plnAmount?.let { amount -> MoneyWeightedCashFlow(date = cashFlow.date, amount = amount) }
        }
        val nominalPln = PortfolioReturnCalculator.calculateMetric(
            start = input.window.effectiveFrom,
            end = input.history.until,
            values = plnValues,
            cashFlows = plnCashFlows
        )
        val nominalUsd = PortfolioReturnCalculator.calculateMetric(
            start = input.window.effectiveFrom,
            end = input.history.until,
            values = input.history.points.mapNotNull { point ->
                point.totalCurrentValueUsd?.let { value -> ValuationPoint(date = point.date, value = value) }
            },
            cashFlows = input.externalCashFlows.mapNotNull { cashFlow ->
                cashFlow.usdAmount?.let { amount -> MoneyWeightedCashFlow(date = cashFlow.date, amount = amount) }
            }
        )
        val realPlnAdjustment = loadRealPlnAdjustment(
            effectiveFrom = input.window.effectiveFrom,
            end = input.history.until,
            values = plnValues,
            cashFlows = plnCashFlows
        )

        return PortfolioReturnPeriod(
            key = input.window.definition.key,
            label = input.window.definition.label,
            requestedFrom = input.window.requestedFrom,
            from = input.window.effectiveFrom,
            until = input.history.until,
            clippedToInception = input.window.effectiveFrom != input.window.requestedFrom,
            dayCount = ChronoUnit.DAYS.between(input.window.effectiveFrom, input.history.until),
            nominalPln = nominalPln,
            nominalUsd = nominalUsd,
            realPln = realPlnAdjustment?.metric,
            inflation = realPlnAdjustment?.inflationWindow,
            breakdown = PortfolioReturnBreakdownCalculator.calculate(
                start = input.window.effectiveFrom,
                end = input.history.until,
                values = plnValues,
                transactions = input.transactions,
                fxLookups = input.fxLookups
            ),
            benchmarks = input.buildBenchmarkComparisons(nominalPln)
        )
    }

    private fun PeriodBuildInput.buildBenchmarkComparisons(
        nominalPln: ReturnMetric?
    ): List<BenchmarkComparison> {
        val healthByKey = history.benchmarkStatuses.associateBy(BenchmarkSeriesHealth::key)
        return benchmarkSettings.options
            .asSequence()
            .filter { option -> benchmarkSettings.isEnabled(option.key) }
            .mapNotNull { option ->
                val values = history.points.mapNotNull { point ->
                    point.benchmarkIndices[option.key]?.let { value ->
                        ValuationPoint(date = point.date, value = value)
                    }
                }
                val health = healthByKey[option.key]
                if (health == null && values.isEmpty()) {
                    return@mapNotNull null
                }
                buildBenchmarkComparison(
                    option = option,
                    start = window.effectiveFrom,
                    end = history.until,
                    portfolioMetric = nominalPln,
                    pinned = benchmarkSettings.isPinned(option.key),
                    values = values,
                    health = health
                )
            }
            .toList()
            .sortedWith(compareByDescending<BenchmarkComparison> { it.pinned }.thenBy(BenchmarkComparison::label))
    }

    private fun buildBenchmarkComparison(
        option: BenchmarkOptionDefinition,
        start: LocalDate,
        end: LocalDate,
        portfolioMetric: ReturnMetric?,
        pinned: Boolean,
        values: List<ValuationPoint>,
        health: BenchmarkSeriesHealth?
    ): BenchmarkComparison {
        val metric = PortfolioReturnCalculator.calculateBenchmarkMetric(start = start, end = end, values = values)
        val status = health?.status ?: BenchmarkSeriesStatus.HEALTHY
        val resolvedStatus = when {
            metric != null -> status
            status == BenchmarkSeriesStatus.HEALTHY -> BenchmarkSeriesStatus.UNAVAILABLE
            else -> status
        }
        val resolvedIssue = health?.issue ?: if (metric == null) {
            "Benchmark series does not cover the selected period."
        } else {
            null
        }

        return BenchmarkComparison(
            key = option.key,
            label = option.label,
            pinned = pinned,
            nominalPln = metric,
            excessTimeWeightedReturn = subtractRates(
                portfolioMetric?.timeWeightedReturn,
                metric?.timeWeightedReturn
            ),
            excessAnnualizedTimeWeightedReturn = subtractRates(
                portfolioMetric?.annualizedTimeWeightedReturn,
                metric?.annualizedTimeWeightedReturn
            ),
            status = resolvedStatus,
            issue = resolvedIssue
        )
    }

    private fun buildRollingReturns(history: PortfolioDailyHistory): List<RollingReturnWindow> {
        val indexPoints = history.performanceIndexPoints()
        return RollingReturnWindowDefinition.entries.map { definition ->
            val observations = calculateRollingReturnObservations(
                indexPoints = indexPoints,
                definition = definition
            )
            RollingReturnWindow(
                key = definition.key,
                label = definition.label,
                years = definition.years,
                observationCount = observations.size,
                latest = observations.lastOrNull(),
                best = observations.maxByOrNull(RollingReturnObservation::totalReturn),
                worst = observations.minByOrNull(RollingReturnObservation::totalReturn),
                observations = observations
            )
        }
    }

    private fun calculateRollingReturnObservations(
        indexPoints: List<PerformanceIndexPoint>,
        definition: RollingReturnWindowDefinition
    ): List<RollingReturnObservation> {
        if (indexPoints.size < 2) {
            return emptyList()
        }

        return indexPoints.mapNotNull { endPoint ->
            val requestedStart = endPoint.date.minusYears(definition.years.toLong())
            val startPoint = indexPoints.lastOrNull { point -> !point.date.isAfter(requestedStart) }
                ?: return@mapNotNull null
            if (startPoint.index.signum() <= 0 || endPoint.index.signum() <= 0) {
                return@mapNotNull null
            }
            val dayCount = ChronoUnit.DAYS.between(startPoint.date, endPoint.date)
            if (dayCount <= 0) {
                return@mapNotNull null
            }

            val totalFactor = endPoint.index.divide(startPoint.index, 16, RoundingMode.HALF_UP)
            val totalReturn = totalFactor.subtract(BigDecimal.ONE).toRate()
            val annualizedReturn = ((totalFactor.toDouble()).pow(365.0 / dayCount.toDouble()) - 1.0)
                .takeIf(Double::isFinite)
                ?.toRate()

            RollingReturnObservation(
                from = startPoint.date,
                until = endPoint.date,
                dayCount = dayCount,
                totalReturn = totalReturn,
                annualizedReturn = annualizedReturn
            )
        }
    }

    private fun buildDrawdowns(history: PortfolioDailyHistory): PortfolioDrawdowns {
        val indexPoints = history.performanceIndexPoints()
        if (indexPoints.isEmpty()) {
            return PortfolioDrawdowns(
                current = null,
                max = null,
                observations = emptyList(),
                episodes = emptyList()
            )
        }

        var peakPoint = indexPoints.first()
        var activeEpisode: MutableDrawdownEpisode? = null
        val observations = mutableListOf<DrawdownObservation>()
        val episodes = mutableListOf<DrawdownEpisode>()

        indexPoints.forEach { point ->
            if (point.index >= peakPoint.index) {
                activeEpisode?.let { episode ->
                    episodes += episode.toRecoveredEpisode(point.date)
                    activeEpisode = null
                }
                peakPoint = point
            }

            val drawdown = calculateDrawdown(point.index, peakPoint.index)
            val observation = DrawdownObservation(
                date = point.date,
                peakDate = peakPoint.date,
                peakIndex = peakPoint.index.scaleIndex(),
                index = point.index.scaleIndex(),
                drawdown = drawdown
            )
            observations += observation

            if (drawdown.signum() < 0) {
                val active = activeEpisode
                if (active == null) {
                    activeEpisode = MutableDrawdownEpisode(
                        peakDate = peakPoint.date,
                        startDate = point.date,
                        troughDate = point.date,
                        depth = drawdown
                    )
                } else if (drawdown < active.depth) {
                    active.troughDate = point.date
                    active.depth = drawdown
                }
            }
        }

        activeEpisode?.let { episode ->
            episodes += episode.toOngoingEpisode(until = indexPoints.last().date)
        }

        return PortfolioDrawdowns(
            current = observations.lastOrNull(),
            max = observations.minByOrNull(DrawdownObservation::drawdown),
            observations = observations,
            episodes = episodes.sortedWith(
                compareBy<DrawdownEpisode> { it.depth }
                    .thenByDescending { it.durationDays }
            )
        )
    }

    private fun PortfolioDailyHistory.performanceIndexPoints(): List<PerformanceIndexPoint> =
        points.mapNotNull { point ->
            val index = point.portfolioPerformanceIndex ?: return@mapNotNull null
            if (index.signum() <= 0) {
                return@mapNotNull null
            }
            PerformanceIndexPoint(
                date = point.date,
                index = index
            )
        }.sortedBy(PerformanceIndexPoint::date)

    private fun calculateDrawdown(
        index: BigDecimal,
        peakIndex: BigDecimal
    ): BigDecimal {
        if (peakIndex.signum() <= 0 || index.signum() <= 0) {
            return BigDecimal.ZERO.toRate()
        }
        return index
            .divide(peakIndex, 16, RoundingMode.HALF_UP)
            .subtract(BigDecimal.ONE)
            .toRate()
    }

    private suspend fun loadUsdPlnLookup(
        from: LocalDate,
        to: LocalDate
    ): TreeMap<LocalDate, BigDecimal> = when (val result = referenceSeriesProvider.usdPln(from = from, to = to)) {
        is ReferenceSeriesResult.Success -> result.prices.associateTo(TreeMap()) { it.date to it.closePricePln.scaleMoney(8) }
        is ReferenceSeriesResult.Failure -> TreeMap()
    }

    private suspend fun loadRealPlnAdjustment(
        effectiveFrom: LocalDate,
        end: LocalDate,
        values: List<ValuationPoint>,
        cashFlows: List<MoneyWeightedCashFlow>
    ): RealPlnAdjustment? {
        val realFromMonth = inflationSupport.alignedRealStartMonth(effectiveFrom)
        val requestedUntilExclusive = inflationSupport.latestCompletePortfolioMonthExclusive(end)
        val inflationSeries = inflationSupport.loadMonthlySeriesWithFallback(realFromMonth, requestedUntilExclusive) ?: return null
        val realUntilExclusive = inflationSeries.until
        if (!realFromMonth.isBefore(realUntilExclusive)) {
            return null
        }

        val multiplier = inflationSeries.points.fold(BigDecimal.ONE) { total, point ->
            total.multiply(point.multiplier).setScale(12, RoundingMode.HALF_UP)
        }.stripTrailingZeros()
        if (multiplier.signum() <= 0) {
            return null
        }

        val earliestValueDate = values.minOfOrNull { it.date } ?: return null
        val realFrom = maxOf(realFromMonth.atDay(1), earliestValueDate)
        val realUntil = realUntilExclusive.atDay(1).minusDays(1)
        if (!realFrom.isBefore(realUntil)) {
            return null
        }
        val nominalMetric = PortfolioReturnCalculator.calculateMetric(
            start = realFrom,
            end = realUntil,
            values = values,
            cashFlows = cashFlows
        ) ?: return null
        val inflationWindow = InflationWindow(
            from = realFromMonth,
            until = realUntilExclusive,
            multiplier = multiplier
        )

        return RealPlnAdjustment(
            metric = PortfolioReturnCalculator.adjustForInflation(
                metric = nominalMetric,
                inflation = inflationWindow,
                periodDayCount = ChronoUnit.DAYS.between(realFrom, realUntil)
            ) ?: return null,
            inflationWindow = inflationWindow
        )
    }

    private fun Transaction.toSignedPlnAmountOrNull(fxLookups: TransactionFxLookups): BigDecimal? {
        val grossPln = fxLookups.convertedAmountsOrNull(this)?.grossPln ?: return null
        return when (type) {
            TransactionType.DEPOSIT -> grossPln.negate()
            TransactionType.WITHDRAWAL -> grossPln
            else -> null
        }
    }

    private fun Transaction.toSignedUsdAmountOrNull(
        fxLookups: TransactionFxLookups,
        usdPlnLookup: TreeMap<LocalDate, BigDecimal>
    ): BigDecimal? {
        val unsignedUsd = when (currency) {
            "USD" -> grossAmount.scaleMoney(8)
            else -> {
                val grossPln = fxLookups.convertedAmountsOrNull(this)?.grossPln ?: return null
                grossPln.divideBy(usdPlnLookup, tradeDate) ?: return null
            }
        }

        return when (type) {
            TransactionType.DEPOSIT -> unsignedUsd.negate()
            TransactionType.WITHDRAWAL -> unsignedUsd
            else -> null
        }
    }

    private fun BigDecimal.divideBy(
        lookup: TreeMap<LocalDate, BigDecimal>,
        date: LocalDate
    ): BigDecimal? {
        val divisor = lookup.floorEntry(date)?.value
        if (divisor == null || divisor.signum() == 0) {
            return null
        }
        return divide(divisor, 8, RoundingMode.HALF_UP).scaleMoney(8)
    }

    private fun BigDecimal.scaleMoney(scale: Int): BigDecimal =
        setScale(scale, RoundingMode.HALF_UP).stripTrailingZeros()

    private fun Double.toRate(): BigDecimal =
        BigDecimal.valueOf(this).setScale(10, RoundingMode.HALF_UP).stripTrailingZeros()

    private fun BigDecimal.toRate(): BigDecimal =
        setScale(10, RoundingMode.HALF_UP).stripTrailingZeros()

    private fun BigDecimal.scaleIndex(): BigDecimal =
        setScale(4, RoundingMode.HALF_UP).stripTrailingZeros()

    private fun subtractRates(
        portfolioValue: BigDecimal?,
        benchmarkValue: BigDecimal?
    ): BigDecimal? = when {
        portfolioValue == null || benchmarkValue == null -> null
        else -> portfolioValue.subtract(benchmarkValue).setScale(10, RoundingMode.HALF_UP).stripTrailingZeros()
    }

    private data class ExternalCashFlow(
        val date: LocalDate,
        val plnAmount: BigDecimal?,
        val usdAmount: BigDecimal?
    )

    private data class PeriodBuildInput(
        val window: ReturnPeriodWindow,
        val history: PortfolioDailyHistory,
        val transactions: List<Transaction>,
        val fxLookups: TransactionFxLookups,
        val externalCashFlows: List<ExternalCashFlow>,
        val benchmarkSettings: PortfolioBenchmarkSettings
    )

    private data class ReturnPeriodWindow(
        val definition: ReturnPeriodDefinition,
        val requestedFrom: LocalDate,
        val effectiveFrom: LocalDate
    )

    private data class RealPlnAdjustment(
        val metric: ReturnMetric,
        val inflationWindow: InflationWindow
    )

    private data class PerformanceIndexPoint(
        val date: LocalDate,
        val index: BigDecimal
    )

    private data class MutableDrawdownEpisode(
        val peakDate: LocalDate,
        val startDate: LocalDate,
        var troughDate: LocalDate,
        var depth: BigDecimal
    ) {
        fun toRecoveredEpisode(recoveredDate: LocalDate): DrawdownEpisode = DrawdownEpisode(
            peakDate = peakDate,
            startDate = startDate,
            troughDate = troughDate,
            recoveredDate = recoveredDate,
            depth = depth,
            durationDays = ChronoUnit.DAYS.between(startDate, troughDate),
            recoveryDays = ChronoUnit.DAYS.between(troughDate, recoveredDate),
            status = DrawdownEpisodeStatus.RECOVERED
        )

        fun toOngoingEpisode(until: LocalDate): DrawdownEpisode = DrawdownEpisode(
            peakDate = peakDate,
            startDate = startDate,
            troughDate = troughDate,
            recoveredDate = null,
            depth = depth,
            durationDays = ChronoUnit.DAYS.between(startDate, until),
            recoveryDays = null,
            status = DrawdownEpisodeStatus.ONGOING
        )
    }

    private enum class ReturnPeriodDefinition(
        val key: ReturnPeriodKey,
        val label: String
    ) {
        YTD(key = ReturnPeriodKey.YTD, label = "YTD"),
        ONE_YEAR(key = ReturnPeriodKey.ONE_YEAR, label = "1Y"),
        THREE_YEARS(key = ReturnPeriodKey.THREE_YEARS, label = "3Y"),
        FIVE_YEARS(key = ReturnPeriodKey.FIVE_YEARS, label = "5Y"),
        MAX(key = ReturnPeriodKey.MAX, label = "MAX");

        fun requestedFrom(today: LocalDate): LocalDate = when (this) {
            YTD -> LocalDate.of(today.year, 1, 1)
            ONE_YEAR -> today.minusYears(1)
            THREE_YEARS -> today.minusYears(3)
            FIVE_YEARS -> today.minusYears(5)
            MAX -> LocalDate.MIN
        }
    }

    private enum class RollingReturnWindowDefinition(
        val key: RollingReturnWindowKey,
        val label: String,
        val years: Int
    ) {
        ONE_YEAR(key = RollingReturnWindowKey.ONE_YEAR, label = "1Y rolling TWR", years = 1),
        THREE_YEARS(key = RollingReturnWindowKey.THREE_YEARS, label = "3Y rolling TWR", years = 3),
        FIVE_YEARS(key = RollingReturnWindowKey.FIVE_YEARS, label = "5Y rolling TWR", years = 5)
    }

    private companion object
}

data class PortfolioReturns(
    val asOf: LocalDate,
    val periods: List<PortfolioReturnPeriod>,
    val rollingReturns: List<RollingReturnWindow>,
    val drawdowns: PortfolioDrawdowns
)

data class PortfolioReturnPeriod(
    val key: ReturnPeriodKey,
    val label: String,
    val requestedFrom: LocalDate,
    val from: LocalDate,
    val until: LocalDate,
    val clippedToInception: Boolean,
    val dayCount: Long,
    val nominalPln: ReturnMetric?,
    val nominalUsd: ReturnMetric?,
    val realPln: ReturnMetric?,
    val inflation: InflationWindow?,
    val breakdown: ReturnBreakdown?,
    val benchmarks: List<BenchmarkComparison>
)

data class ReturnBreakdown(
    val openingValuePln: BigDecimal,
    val closingValuePln: BigDecimal,
    val netChangePln: BigDecimal,
    val netExternalFlowsPln: BigDecimal,
    val interestAndCouponsPln: BigDecimal,
    val feesPln: BigDecimal,
    val taxesPln: BigDecimal,
    val marketAndFxPln: BigDecimal,
    val netInvestmentResultPln: BigDecimal,
    val skippedFxTransactionCount: Int
)

data class ReturnMetric(
    val moneyWeightedReturn: BigDecimal,
    val annualizedMoneyWeightedReturn: BigDecimal?,
    val timeWeightedReturn: BigDecimal?,
    val annualizedTimeWeightedReturn: BigDecimal?
)

data class RollingReturnWindow(
    val key: RollingReturnWindowKey,
    val label: String,
    val years: Int,
    val observationCount: Int,
    val latest: RollingReturnObservation?,
    val best: RollingReturnObservation?,
    val worst: RollingReturnObservation?,
    val observations: List<RollingReturnObservation>
)

data class RollingReturnObservation(
    val from: LocalDate,
    val until: LocalDate,
    val dayCount: Long,
    val totalReturn: BigDecimal,
    val annualizedReturn: BigDecimal?
)

data class PortfolioDrawdowns(
    val current: DrawdownObservation?,
    val max: DrawdownObservation?,
    val observations: List<DrawdownObservation>,
    val episodes: List<DrawdownEpisode>
)

data class DrawdownObservation(
    val date: LocalDate,
    val peakDate: LocalDate,
    val peakIndex: BigDecimal,
    val index: BigDecimal,
    val drawdown: BigDecimal
)

data class DrawdownEpisode(
    val peakDate: LocalDate,
    val startDate: LocalDate,
    val troughDate: LocalDate,
    val recoveredDate: LocalDate?,
    val depth: BigDecimal,
    val durationDays: Long,
    val recoveryDays: Long?,
    val status: DrawdownEpisodeStatus
)

enum class RollingReturnWindowKey {
    ONE_YEAR,
    THREE_YEARS,
    FIVE_YEARS
}

enum class DrawdownEpisodeStatus {
    RECOVERED,
    ONGOING
}

data class InflationWindow(
    val from: YearMonth,
    val until: YearMonth,
    val multiplier: BigDecimal
)

data class BenchmarkComparison(
    val key: String,
    val label: String,
    val pinned: Boolean,
    val nominalPln: ReturnMetric?,
    val excessTimeWeightedReturn: BigDecimal?,
    val excessAnnualizedTimeWeightedReturn: BigDecimal?,
    val status: BenchmarkSeriesStatus = BenchmarkSeriesStatus.HEALTHY,
    val issue: String? = null
)

enum class BenchmarkSeriesStatus {
    HEALTHY,
    STALE,
    UNAVAILABLE
}

data class BenchmarkSeriesHealth(
    val key: String,
    val label: String,
    val status: BenchmarkSeriesStatus,
    val issue: String? = null
)

enum class ReturnPeriodKey {
    YTD,
    ONE_YEAR,
    THREE_YEARS,
    FIVE_YEARS,
    MAX
}

enum class BenchmarkKey {
    VWRA,
    V80A,
    V60A,
    V40A,
    V20A,
    VAGF,
    CUSTOM_1,
    CUSTOM_2,
    CUSTOM_3,
    INFLATION,
    TARGET_MIX
}
