package net.bobinski.portfolio.api.domain.service

import kotlin.math.abs
import kotlin.math.pow
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.InflationSeriesResult
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
                            definition = definition,
                            requestedFrom = requestedFrom,
                            effectiveFrom = effectiveFrom,
                            history = history,
                            transactions = transactions,
                            fxLookups = fxLookups,
                            externalCashFlows = externalCashFlows,
                            benchmarkSettings = benchmarkSettings
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

    private suspend fun buildPeriod(
        definition: ReturnPeriodDefinition,
        requestedFrom: LocalDate,
        effectiveFrom: LocalDate,
        history: PortfolioDailyHistory,
        transactions: List<Transaction>,
        fxLookups: TransactionFxLookups,
        externalCashFlows: List<ExternalCashFlow>,
        benchmarkSettings: PortfolioBenchmarkSettings
    ): PortfolioReturnPeriod {
        val nominalPln = calculateMetric(
            start = effectiveFrom,
            end = history.until,
            values = history.points.map { ValuationPoint(date = it.date, value = it.totalCurrentValuePln) },
            cashFlows = externalCashFlows.mapNotNull { cashFlow ->
                cashFlow.plnAmount?.let { amount -> MoneyWeightedCashFlow(date = cashFlow.date, amount = amount) }
            }
        )
        val nominalUsd = calculateMetric(
            start = effectiveFrom,
            end = history.until,
            values = history.points.mapNotNull { point ->
                point.totalCurrentValueUsd?.let { value ->
                    ValuationPoint(date = point.date, value = value)
                }
            },
            cashFlows = externalCashFlows.mapNotNull { cashFlow ->
                cashFlow.usdAmount?.let { amount -> MoneyWeightedCashFlow(date = cashFlow.date, amount = amount) }
            }
        )

        val healthByKey = history.benchmarkStatuses.associateBy(BenchmarkSeriesHealth::key)
        val benchmarkComparisons = benchmarkSettings.options
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
                    start = effectiveFrom,
                    end = history.until,
                    portfolioMetric = nominalPln,
                    pinned = benchmarkSettings.isPinned(option.key),
                    values = values,
                    health = health
                )
            }
            .toList()
            .sortedWith(compareByDescending<BenchmarkComparison> { it.pinned }.thenBy(BenchmarkComparison::label))
        val realPlnAdjustment = loadRealPlnAdjustment(
            effectiveFrom = effectiveFrom,
            end = history.until,
            values = history.points.map { ValuationPoint(date = it.date, value = it.totalCurrentValuePln) },
            cashFlows = externalCashFlows.mapNotNull { cashFlow ->
                cashFlow.plnAmount?.let { amount -> MoneyWeightedCashFlow(date = cashFlow.date, amount = amount) }
            }
        )

        return PortfolioReturnPeriod(
            key = definition.key,
            label = definition.label,
            requestedFrom = requestedFrom,
            from = effectiveFrom,
            until = history.until,
            clippedToInception = effectiveFrom != requestedFrom,
            dayCount = ChronoUnit.DAYS.between(effectiveFrom, history.until),
            nominalPln = nominalPln,
            nominalUsd = nominalUsd,
            realPln = realPlnAdjustment?.metric,
            inflation = realPlnAdjustment?.inflationWindow,
            breakdown = calculateBreakdown(
                start = effectiveFrom,
                end = history.until,
                values = history.points.map { ValuationPoint(date = it.date, value = it.totalCurrentValuePln) },
                transactions = transactions,
                fxLookups = fxLookups
            ),
            benchmarks = benchmarkComparisons
        )
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
        val metric = calculateBenchmarkMetric(start = start, end = end, values = values)
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

    private fun calculateBenchmarkMetric(
        start: LocalDate,
        end: LocalDate,
        values: List<ValuationPoint>
    ): ReturnMetric? {
        if (values.isEmpty()) {
            return null
        }

        val startValue = values.valueOnOrBefore(start) ?: return null
        val endValue = values.valueOnOrBefore(end) ?: return null
        val benchmarkCashFlows = listOf(
            MoneyWeightedCashFlow(date = start, amount = startValue.negate()),
            MoneyWeightedCashFlow(date = end, amount = endValue)
        )
        val annualizedReturn = calculateXirr(benchmarkCashFlows) ?: return null
        val dayCount = ChronoUnit.DAYS.between(start, end)
        val moneyWeightedReturn = if (dayCount <= 0) {
            annualizedReturn
        } else {
            (1.0 + annualizedReturn).pow(dayCount.toDouble() / 365.0) - 1.0
        }
        val timeWeighted = calculateTimeWeightedMetric(
            start = start,
            end = end,
            values = values,
            cashFlows = emptyList()
        )

        return ReturnMetric(
            moneyWeightedReturn = moneyWeightedReturn.toRate(),
            annualizedMoneyWeightedReturn = annualizedReturn.toRate(),
            timeWeightedReturn = timeWeighted?.totalReturn,
            annualizedTimeWeightedReturn = timeWeighted?.annualizedReturn
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
        val nominalMetric = calculateMetric(
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
            metric = nominalMetric.adjustForInflation(
                inflation = inflationWindow,
                periodDayCount = ChronoUnit.DAYS.between(realFrom, realUntil)
            ) ?: return null,
            inflationWindow = inflationWindow
        )
    }

    private fun calculateMetric(
        start: LocalDate,
        end: LocalDate,
        values: List<ValuationPoint>,
        cashFlows: List<MoneyWeightedCashFlow>
    ): ReturnMetric? {
        if (values.isEmpty()) {
            return null
        }

        val endValue = values.valueOnOrBefore(end) ?: return null
        val sinceInception = values.none { it.date < start }
        val periodCashFlows = mutableListOf<MoneyWeightedCashFlow>()

        if (!sinceInception) {
            val startValue = values.valueOnOrBefore(start) ?: return null
            periodCashFlows += MoneyWeightedCashFlow(
                date = start,
                amount = startValue.negate()
            )
        }

        periodCashFlows += cashFlows.filter { cashFlow ->
            if (sinceInception) {
                !cashFlow.date.isBefore(start) && !cashFlow.date.isAfter(end)
            } else {
                cashFlow.date.isAfter(start) && !cashFlow.date.isAfter(end)
            }
        }
        periodCashFlows += MoneyWeightedCashFlow(
            date = end,
            amount = endValue
        )
        periodCashFlows.sortBy(MoneyWeightedCashFlow::date)

        val annualizedReturn = calculateXirr(periodCashFlows) ?: return null
        val dayCount = ChronoUnit.DAYS.between(periodCashFlows.first().date, periodCashFlows.last().date)
        val moneyWeightedReturn = if (dayCount <= 0) {
            annualizedReturn
        } else {
            (1.0 + annualizedReturn).pow(dayCount.toDouble() / 365.0) - 1.0
        }
        val timeWeighted = calculateTimeWeightedMetric(
            start = start,
            end = end,
            values = values,
            cashFlows = cashFlows
        )

        return ReturnMetric(
            moneyWeightedReturn = moneyWeightedReturn.toRate(),
            annualizedMoneyWeightedReturn = annualizedReturn.toRate(),
            timeWeightedReturn = timeWeighted?.totalReturn,
            annualizedTimeWeightedReturn = timeWeighted?.annualizedReturn
        )
    }

    private fun calculateBreakdown(
        start: LocalDate,
        end: LocalDate,
        values: List<ValuationPoint>,
        transactions: List<Transaction>,
        fxLookups: TransactionFxLookups
    ): ReturnBreakdown? {
        if (values.isEmpty()) {
            return null
        }

        val closingValue = values.valueOnOrBefore(end)?.scaleMoney(2) ?: return null
        val sinceInception = values.none { it.date < start }
        val openingValue = if (sinceInception) {
            BigDecimal.ZERO.scaleMoney(2)
        } else {
            values.valueOnOrBefore(start)?.scaleMoney(2) ?: return null
        }

        val periodTransactions = transactions.filter { transaction ->
            if (sinceInception) {
                !transaction.tradeDate.isBefore(start) && !transaction.tradeDate.isAfter(end)
            } else {
                transaction.tradeDate.isAfter(start) && !transaction.tradeDate.isAfter(end)
            }
        }

        var netExternalFlows = BigDecimal.ZERO.scaleMoney(2)
        var interestAndCoupons = BigDecimal.ZERO.scaleMoney(2)
        var fees = BigDecimal.ZERO.scaleMoney(2)
        var taxes = BigDecimal.ZERO.scaleMoney(2)
        var skippedFxTransactionCount = 0

        for (transaction in periodTransactions) {
            val converted = fxLookups.convertedAmountsOrNull(transaction)
            if (converted == null) {
                skippedFxTransactionCount += 1
                continue
            }

            when (transaction.type) {
                TransactionType.DEPOSIT -> netExternalFlows = netExternalFlows.add(converted.grossPln).scaleMoney(2)
                TransactionType.WITHDRAWAL -> netExternalFlows = netExternalFlows.subtract(converted.grossPln).scaleMoney(2)
                TransactionType.INTEREST -> interestAndCoupons = interestAndCoupons.add(converted.grossPln).scaleMoney(2)
                TransactionType.FEE -> fees = fees.subtract(converted.grossPln).scaleMoney(2)
                TransactionType.TAX -> taxes = taxes.subtract(converted.grossPln).scaleMoney(2)
                else -> Unit
            }

            if (converted.feePln.signum() > 0) {
                fees = fees.subtract(converted.feePln).scaleMoney(2)
            }
            if (converted.taxPln.signum() > 0) {
                taxes = taxes.subtract(converted.taxPln).scaleMoney(2)
            }
        }

        val netChange = closingValue.subtract(openingValue).scaleMoney(2)
        val marketAndFx = netChange
            .subtract(netExternalFlows)
            .subtract(interestAndCoupons)
            .subtract(fees)
            .subtract(taxes)
            .scaleMoney(2)

        return ReturnBreakdown(
            openingValuePln = openingValue,
            closingValuePln = closingValue,
            netChangePln = netChange,
            netExternalFlowsPln = netExternalFlows,
            interestAndCouponsPln = interestAndCoupons,
            feesPln = fees,
            taxesPln = taxes,
            marketAndFxPln = marketAndFx,
            netInvestmentResultPln = netChange.subtract(netExternalFlows).scaleMoney(2),
            skippedFxTransactionCount = skippedFxTransactionCount
        )
    }

    private fun calculateTimeWeightedMetric(
        start: LocalDate,
        end: LocalDate,
        values: List<ValuationPoint>,
        cashFlows: List<MoneyWeightedCashFlow>
    ): TimeWeightedMetric? {
        val orderedValues = values.sortedBy(ValuationPoint::date)
        val startValue = orderedValues.valueOnOrBefore(start) ?: return null
        val periodValuations = orderedValues.filter { valuation ->
            valuation.date.isAfter(start) && !valuation.date.isAfter(end)
        }
        val dayCount = ChronoUnit.DAYS.between(start, end)
        if (periodValuations.isEmpty()) {
            return TimeWeightedMetric(
                totalReturn = 0.0.toRate(),
                annualizedReturn = 0.0.toRate()
            )
        }

        val cashFlowsByDate = cashFlows.groupBy(MoneyWeightedCashFlow::date)
            .mapValues { (_, items) ->
                items.fold(BigDecimal.ZERO) { total, item -> total.add(item.amount) }
            }
        val totalFactor = TimeWeightedReturnCalculator.totalFactor(
            listOf(TimeWeightedReturnCalculator.Point(date = start, value = startValue)) +
                periodValuations.map { valuation ->
                    TimeWeightedReturnCalculator.Point(
                        date = valuation.date,
                        value = valuation.value,
                        externalFlowIntoPortfolio = cashFlowsByDate[valuation.date]?.negate() ?: BigDecimal.ZERO
                    )
                }
        ) ?: return null

        val totalReturn = totalFactor - 1.0
        val annualizedReturn = when {
            dayCount <= 0 -> totalReturn
            totalFactor <= 0.0 -> -1.0
            else -> totalFactor.pow(365.0 / dayCount.toDouble()) - 1.0
        }

        return TimeWeightedMetric(
            totalReturn = totalReturn.toRate(),
            annualizedReturn = annualizedReturn.toRate()
        )
    }

    private fun calculateXirr(cashFlows: List<MoneyWeightedCashFlow>): Double? {
        if (cashFlows.size < 2) {
            return null
        }

        val ordered = cashFlows.sortedBy(MoneyWeightedCashFlow::date)
        val amounts = ordered.map { it.amount.toDouble() }
        if (amounts.none { it > 0.0 } || amounts.none { it < 0.0 }) {
            return null
        }

        val t0 = ordered.first().date
        val days = ordered.map { ChronoUnit.DAYS.between(t0, it.date).toDouble() }

        fun safeRate(rate: Double): Double = maxOf(rate, -0.9999999)

        fun npv(rate: Double): Double {
            val normalizedRate = safeRate(rate)
            return amounts.indices.sumOf { index ->
                amounts[index] / (1.0 + normalizedRate).pow(days[index] / 365.0)
            }
        }

        fun dnpv(rate: Double): Double {
            val normalizedRate = safeRate(rate)
            return amounts.indices.sumOf { index ->
                val exponent = days[index] / 365.0
                -(exponent * amounts[index]) / (1.0 + normalizedRate).pow(exponent + 1.0)
            }
        }

        var guess = if (amounts.filter { it > 0.0 }.sum() / -amounts.filter { it < 0.0 }.sum() - 1.0 < 0.0) {
            -0.5
        } else {
            0.1
        }

        repeat(50) {
            val value = npv(guess)
            val derivative = dnpv(guess)
            if (!value.isFinite() || !derivative.isFinite() || abs(derivative) < 1e-20) {
                return@repeat
            }
            val next = guess - value / derivative
            if (!next.isFinite()) {
                return@repeat
            }
            if (abs(next - guess) < 1e-10) {
                return next
            }
            guess = next
        }

        var low = -0.9999
        var high = 10.0
        var lowValue = npv(low)
        var highValue = npv(high)
        repeat(20) {
            if (lowValue * highValue <= 0.0) {
                return@repeat
            }
            high *= 2.0
            highValue = npv(high)
        }
        if (lowValue * highValue > 0.0) {
            return null
        }

        repeat(100) {
            val mid = (low + high) / 2.0
            val midValue = npv(mid)
            if (!midValue.isFinite() || abs(midValue) < 1e-10) {
                return mid
            }
            if (lowValue * midValue < 0.0) {
                high = mid
                highValue = midValue
            } else {
                low = mid
                lowValue = midValue
            }
        }

        return (low + high) / 2.0
    }

    private fun ReturnMetric.adjustForInflation(
        inflation: InflationWindow?,
        periodDayCount: Long
    ): ReturnMetric? {
        if (inflation == null || inflation.multiplier.signum() <= 0) {
            return null
        }

        val nominalTotal = 1.0 + moneyWeightedReturn.toDouble()
        val realTotal = nominalTotal / inflation.multiplier.toDouble() - 1.0
        val realAnnualized = annualizedMoneyWeightedReturn?.let {
            if (periodDayCount <= 0) {
                realTotal
            } else {
                (1.0 + realTotal).pow(365.0 / periodDayCount.toDouble()) - 1.0
            }
        }
        val realTimeWeighted = timeWeightedReturn?.let { value ->
            (1.0 + value.toDouble()) / inflation.multiplier.toDouble() - 1.0
        }
        val realAnnualizedTimeWeighted = annualizedTimeWeightedReturn?.let {
            if (periodDayCount <= 0) {
                realTimeWeighted
            } else {
                realTimeWeighted?.let { value ->
                    (1.0 + value).pow(365.0 / periodDayCount.toDouble()) - 1.0
                }
            }
        }

        return ReturnMetric(
            moneyWeightedReturn = realTotal.toRate(),
            annualizedMoneyWeightedReturn = realAnnualized?.toRate(),
            timeWeightedReturn = realTimeWeighted?.toRate(),
            annualizedTimeWeightedReturn = realAnnualizedTimeWeighted?.toRate()
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

    private fun List<ValuationPoint>.valueOnOrBefore(date: LocalDate): BigDecimal? =
        lastOrNull { it.date <= date }?.value

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

    private data class MoneyWeightedCashFlow(
        val date: LocalDate,
        val amount: BigDecimal
    )

    private data class ValuationPoint(
        val date: LocalDate,
        val value: BigDecimal
    )

    private data class TimeWeightedMetric(
        val totalReturn: BigDecimal,
        val annualizedReturn: BigDecimal?
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
