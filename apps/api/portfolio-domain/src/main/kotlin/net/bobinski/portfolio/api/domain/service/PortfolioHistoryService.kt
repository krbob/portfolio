package net.bobinski.portfolio.api.domain.service

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlin.math.pow
import net.bobinski.portfolio.api.domain.model.Account
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.model.toLotTerms
import net.bobinski.portfolio.api.domain.repository.AccountRepository
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import net.bobinski.portfolio.api.domain.repository.PortfolioTargetRepository
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import net.bobinski.portfolio.api.marketdata.model.HistoricalPricePoint
import net.bobinski.portfolio.api.marketdata.service.EdoLotValuationProvider
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationProvider
import net.bobinski.portfolio.api.marketdata.service.HistoricalInstrumentValuationResult
import net.bobinski.portfolio.api.marketdata.service.InflationAdjustmentProvider
import net.bobinski.portfolio.api.marketdata.service.InflationSeriesResult
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesProvider
import net.bobinski.portfolio.api.marketdata.service.ReferenceSeriesResult
import java.math.BigDecimal
import java.math.MathContext
import java.math.RoundingMode
import java.time.Clock
import java.time.LocalDate
import java.time.YearMonth
import java.util.TreeMap
import java.util.UUID

class PortfolioHistoryService(
    private val accountRepository: AccountRepository,
    private val instrumentRepository: InstrumentRepository,
    private val portfolioTargetRepository: PortfolioTargetRepository,
    private val transactionRepository: TransactionRepository,
    private val historicalInstrumentValuationProvider: HistoricalInstrumentValuationProvider,
    private val edoLotValuationProvider: EdoLotValuationProvider,
    private val referenceSeriesProvider: ReferenceSeriesProvider,
    private val inflationAdjustmentProvider: InflationAdjustmentProvider,
    private val transactionFxConversionService: TransactionFxConversionService,
    private val clock: Clock
) {
    suspend fun dailyHistory(): PortfolioDailyHistory {
        val accounts = accountRepository.list()
        val instruments = instrumentRepository.list()
        val transactions = transactionRepository.list()
            .sortedWith(compareBy<Transaction>({ it.tradeDate }, { it.createdAt }))

        if (transactions.isEmpty()) {
            val today = LocalDate.now(clock)
            return PortfolioDailyHistory(
                from = today,
                until = today,
                valuationState = ValuationState.MARK_TO_MARKET,
                instrumentHistoryIssueCount = 0,
                referenceSeriesIssueCount = 0,
                benchmarkSeriesIssueCount = 0,
                missingFxTransactions = 0,
                unsupportedCorrectionTransactions = 0,
                points = emptyList()
            )
        }

        val from = transactions.minOf(Transaction::tradeDate)
        val until = LocalDate.now(clock)
        val historyLoads = loadInstrumentHistories(
            instruments = instruments,
            transactions = transactions,
            from = from,
            until = until
        )
        val referenceLoads = loadReferenceSeries(from = from, until = until)
        val benchmarkLoads = loadBenchmarkSeries(from = from, until = until)
        val accountsById = accounts.associateBy(Account::id)
        val instrumentsById = instruments.associateBy(Instrument::id)
        val transactionsByDate = transactions.groupBy(Transaction::tradeDate)
        val fxLookups = transactionFxConversionService.loadLookups(transactions)
        val holdings = linkedMapOf<HoldingKey, MutableHolding>()

        var cashBalancePln = BigDecimal.ZERO
        var netContributionsPln = BigDecimal.ZERO
        var netContributionsUsd = BigDecimal.ZERO
        var netContributionsAu = BigDecimal.ZERO
        var missingFxTransactions = 0
        var unsupportedCorrectionTransactions = 0
        val points = mutableListOf<PortfolioDailyHistoryPoint>()

        var date = from
        while (!date.isAfter(until)) {
            transactionsByDate[date].orEmpty().forEach { transaction ->
                val converted = fxLookups.convertedAmountsOrNull(transaction)
                if (converted == null) {
                    missingFxTransactions += 1
                    return@forEach
                }

                when (transaction.type) {
                    TransactionType.BUY -> {
                        val instrument = instrumentsById[transaction.instrumentId] ?: return@forEach
                        val account = accountsById[transaction.accountId] ?: return@forEach
                        val holding = holdings.getOrPut(HoldingKey(account.id, instrument.id)) {
                            MutableHolding(account = account, instrument = instrument)
                        }
                        val buyQuantity = transaction.quantity ?: BigDecimal.ZERO
                        val buyCostBasis = converted.grossPln
                            .add(converted.feePln, MONEY_CONTEXT)
                            .add(converted.taxPln, MONEY_CONTEXT)
                        if (instrument.kind == InstrumentKind.BOND_EDO) {
                            holding.addEdoLot(
                                purchaseDate = transaction.tradeDate,
                                quantity = buyQuantity,
                                costBasisPln = buyCostBasis
                            )
                        } else {
                            holding.quantity = holding.quantity.add(buyQuantity, MONEY_CONTEXT)
                            holding.costBasisPln = holding.costBasisPln.add(buyCostBasis, MONEY_CONTEXT)
                        }
                        holding.transactionCount += 1

                        cashBalancePln = cashBalancePln
                            .subtract(converted.grossPln, MONEY_CONTEXT)
                            .subtract(converted.feePln, MONEY_CONTEXT)
                            .subtract(converted.taxPln, MONEY_CONTEXT)
                    }

                    TransactionType.SELL -> {
                        val instrument = instrumentsById[transaction.instrumentId] ?: return@forEach
                        val account = accountsById[transaction.accountId] ?: return@forEach
                        val holding = holdings.getOrPut(HoldingKey(account.id, instrument.id)) {
                            MutableHolding(account = account, instrument = instrument)
                        }
                        val sellQuantity = transaction.quantity ?: BigDecimal.ZERO
                        val quantityBefore = holding.quantity
                        val costBasisBefore = holding.costBasisPln

                        if (quantityBefore.signum() > 0 && sellQuantity.signum() > 0) {
                            if (instrument.kind == InstrumentKind.BOND_EDO) {
                                holding.reduceEdoLotsFifo(sellQuantity)
                            } else {
                                val reducedCostBasis = if (sellQuantity >= quantityBefore) {
                                    costBasisBefore
                                } else {
                                    costBasisBefore
                                        .divide(quantityBefore, 12, RoundingMode.HALF_UP)
                                        .multiply(sellQuantity, MONEY_CONTEXT)
                                }
                                holding.quantity = quantityBefore.subtract(sellQuantity, MONEY_CONTEXT).max(BigDecimal.ZERO)
                                holding.costBasisPln = costBasisBefore
                                    .subtract(reducedCostBasis, MONEY_CONTEXT)
                                    .max(BigDecimal.ZERO)
                            }
                        }
                        holding.transactionCount += 1

                        cashBalancePln = cashBalancePln
                            .add(converted.grossPln, MONEY_CONTEXT)
                            .subtract(converted.feePln, MONEY_CONTEXT)
                            .subtract(converted.taxPln, MONEY_CONTEXT)
                    }

                    TransactionType.DEPOSIT -> {
                        cashBalancePln = cashBalancePln.add(converted.grossPln, MONEY_CONTEXT)
                        netContributionsPln = netContributionsPln.add(converted.grossPln, MONEY_CONTEXT)
                        netContributionsUsd = netContributionsUsd.addReferenceUnits(
                            amountPln = converted.grossPln,
                            lookup = referenceLoads.usdPln,
                            date = transaction.tradeDate
                        )
                        netContributionsAu = netContributionsAu.addReferenceUnits(
                            amountPln = converted.grossPln,
                            lookup = referenceLoads.goldPln,
                            date = transaction.tradeDate
                        )
                    }

                    TransactionType.WITHDRAWAL -> {
                        cashBalancePln = cashBalancePln.subtract(converted.grossPln, MONEY_CONTEXT)
                        netContributionsPln = netContributionsPln.subtract(converted.grossPln, MONEY_CONTEXT)
                        netContributionsUsd = netContributionsUsd.subtractReferenceUnits(
                            amountPln = converted.grossPln,
                            lookup = referenceLoads.usdPln,
                            date = transaction.tradeDate
                        )
                        netContributionsAu = netContributionsAu.subtractReferenceUnits(
                            amountPln = converted.grossPln,
                            lookup = referenceLoads.goldPln,
                            date = transaction.tradeDate
                        )
                    }

                    TransactionType.FEE,
                    TransactionType.TAX -> {
                        cashBalancePln = cashBalancePln.subtract(converted.grossPln, MONEY_CONTEXT)
                    }

                    TransactionType.INTEREST -> {
                        cashBalancePln = cashBalancePln.add(converted.grossPln, MONEY_CONTEXT)
                    }

                    TransactionType.CORRECTION -> {
                        unsupportedCorrectionTransactions += 1
                    }
                }
            }

            val activeHoldings = holdings.values.filter { it.quantity.signum() > 0 }
            val valuedHoldingCount = activeHoldings.count { holding -> holding.isValuedOn(date, historyLoads) }

            val equityCurrentValuePln = activeHoldings
                .filter { it.instrument.assetClass == AssetClass.EQUITIES }
                .sumOf { holding -> holding.currentValueOn(date, historyLoads).money() }
            val bondCurrentValuePln = activeHoldings
                .filter { it.instrument.assetClass == AssetClass.BONDS }
                .sumOf { holding -> holding.currentValueOn(date, historyLoads).money() }
            val investedBookValuePln = activeHoldings.sumOf { it.costBasisPln.money() }
            val investedCurrentValuePln = activeHoldings.sumOf { it.currentValueOn(date, historyLoads).money() }
            val cashCurrentValuePln = cashBalancePln.money()
            val totalBookValuePln = investedBookValuePln.add(cashCurrentValuePln, MONEY_CONTEXT).money()
            val totalCurrentValuePln = investedCurrentValuePln.add(cashCurrentValuePln, MONEY_CONTEXT).money()

            points += PortfolioDailyHistoryPoint(
                date = date,
                totalBookValuePln = totalBookValuePln,
                totalCurrentValuePln = totalCurrentValuePln,
                netContributionsPln = netContributionsPln.money(),
                cashBalancePln = cashCurrentValuePln,
                totalCurrentValueUsd = totalCurrentValuePln.divideBy(referenceLoads.usdPln, date),
                netContributionsUsd = netContributionsUsd.referenceUnits(),
                cashBalanceUsd = cashCurrentValuePln.divideBy(referenceLoads.usdPln, date),
                totalCurrentValueAu = totalCurrentValuePln.divideBy(referenceLoads.goldPln, date),
                netContributionsAu = netContributionsAu.referenceUnits(),
                cashBalanceAu = cashCurrentValuePln.divideBy(referenceLoads.goldPln, date),
                equityCurrentValuePln = equityCurrentValuePln.money(),
                bondCurrentValuePln = bondCurrentValuePln.money(),
                cashCurrentValuePln = cashCurrentValuePln,
                equityAllocationPct = totalCurrentValuePln.ratioOf(equityCurrentValuePln),
                bondAllocationPct = totalCurrentValuePln.ratioOf(bondCurrentValuePln),
                cashAllocationPct = totalCurrentValuePln.ratioOf(cashCurrentValuePln),
                portfolioPerformanceIndex = null,
                equityBenchmarkIndex = null,
                inflationBenchmarkIndex = null,
                targetMixBenchmarkIndex = null,
                activeHoldingCount = activeHoldings.size,
                valuedHoldingCount = valuedHoldingCount
            )

            date = date.plusDays(1)
        }

        val enrichedPoints = attachBenchmarkIndices(
            points = points,
            benchmarkLoads = benchmarkLoads
        )

        return PortfolioDailyHistory(
            from = from,
            until = until,
            valuationState = historyLoads.valuationState,
            instrumentHistoryIssueCount = historyLoads.issueCount,
            referenceSeriesIssueCount = referenceLoads.issueCount,
            benchmarkSeriesIssueCount = benchmarkLoads.issueCount,
            missingFxTransactions = missingFxTransactions,
            unsupportedCorrectionTransactions = unsupportedCorrectionTransactions,
            points = enrichedPoints
        )
    }

    private suspend fun loadInstrumentHistories(
        instruments: List<Instrument>,
        transactions: List<Transaction>,
        from: LocalDate,
        until: LocalDate
    ): HistoricalLoads = coroutineScope {
        val usedInstrumentIds = transactions.mapNotNull(Transaction::instrumentId).toSet()
        val usedInstruments = instruments.filter { it.id in usedInstrumentIds }
        val nonEdoInstruments = usedInstruments.filter { it.kind != InstrumentKind.BOND_EDO }
        val edoInstruments = usedInstruments.filter { it.kind == InstrumentKind.BOND_EDO }
        val edoLotsByInstrument = transactions
            .asSequence()
            .filter { it.type == TransactionType.BUY }
            .filter { it.instrumentId in edoInstruments.map(Instrument::id).toSet() }
            .mapNotNull { transaction ->
                transaction.instrumentId?.let { instrumentId ->
                    instrumentId to transaction.tradeDate
                }
            }
            .groupBy({ it.first }, { it.second })
            .mapValues { (_, dates) -> dates.distinct().sorted() }

        val instrumentResults = nonEdoInstruments
            .map { instrument ->
                async { instrument.id to historicalInstrumentValuationProvider.dailyPriceSeries(instrument, from, until) }
            }
            .awaitAll()
            .toMap()
        val edoLotResults = edoInstruments
            .flatMap { instrument ->
                val terms = instrument.edoTerms ?: return@flatMap emptyList()
                edoLotsByInstrument[instrument.id].orEmpty().map { purchaseDate ->
                    async {
                        EdoLotKey(instrument.id, purchaseDate) to edoLotValuationProvider.dailyPriceSeries(
                            lotTerms = terms.toLotTerms(purchaseDate),
                            from = from,
                            to = until
                        )
                    }
                }
            }
            .awaitAll()
            .toMap()

        val instrumentLookups = instrumentResults.mapValues { (_, result) ->
            when (result) {
                is HistoricalInstrumentValuationResult.Success -> result.prices.toLookup()
                is HistoricalInstrumentValuationResult.Failure -> TreeMap()
            }
        }
        val edoLotLookups = edoLotResults.mapValues { (_, result) ->
            when (result) {
                is HistoricalInstrumentValuationResult.Success -> result.prices.toLookup()
                is HistoricalInstrumentValuationResult.Failure -> TreeMap()
            }
        }
        val successfulInstrumentIds = buildSet {
            instrumentResults.forEach { (instrumentId, result) ->
                if (result is HistoricalInstrumentValuationResult.Success) {
                    add(instrumentId)
                }
            }
            edoInstruments.forEach { instrument ->
                val lotDates = edoLotsByInstrument[instrument.id].orEmpty()
                if (lotDates.isNotEmpty() && lotDates.all { purchaseDate ->
                        edoLotResults[EdoLotKey(instrument.id, purchaseDate)] is HistoricalInstrumentValuationResult.Success
                    }
                ) {
                    add(instrument.id)
                }
            }
        }
        val issueCount = usedInstrumentIds.subtract(successfulInstrumentIds).size
        val successCount = successfulInstrumentIds.size
        val valuationState = when {
            usedInstrumentIds.isEmpty() -> ValuationState.MARK_TO_MARKET
            successCount == usedInstrumentIds.size -> ValuationState.MARK_TO_MARKET
            successCount == 0 -> ValuationState.BOOK_ONLY
            else -> ValuationState.PARTIALLY_VALUED
        }

        HistoricalLoads(
            lookups = instrumentLookups,
            edoLotLookups = edoLotLookups,
            issueCount = issueCount,
            valuationState = valuationState
        )
    }

    private suspend fun loadReferenceSeries(
        from: LocalDate,
        until: LocalDate
    ): ReferenceLoads = coroutineScope {
        val usdDeferred = async { referenceSeriesProvider.usdPln(from = from, to = until) }
        val goldDeferred = async { referenceSeriesProvider.goldPln(from = from, to = until) }

        val usd = usdDeferred.await()
        val gold = goldDeferred.await()

        ReferenceLoads(
            usdPln = when (usd) {
                is ReferenceSeriesResult.Success -> usd.prices.toLookup()
                is ReferenceSeriesResult.Failure -> TreeMap()
            },
            goldPln = when (gold) {
                is ReferenceSeriesResult.Success -> gold.prices.toLookup()
                is ReferenceSeriesResult.Failure -> TreeMap()
            },
            issueCount = listOf(usd, gold).count { it is ReferenceSeriesResult.Failure }
        )
    }

    private suspend fun loadBenchmarkSeries(
        from: LocalDate,
        until: LocalDate
    ): BenchmarkLoads = coroutineScope {
        val equityDeferred = async { referenceSeriesProvider.equityBenchmarkPln(from = from, to = until) }
        val bondDeferred = async { referenceSeriesProvider.bondBenchmarkPln(from = from, to = until) }
        val targetsDeferred = async { portfolioTargetRepository.list() }
        val inflationDeferred = async { loadInflationBenchmark(from = from, until = until) }

        val equity = equityDeferred.await()
        val bond = bondDeferred.await()
        val targets = targetsDeferred.await()
        val inflation = inflationDeferred.await()
        val equityLookup = when (equity) {
            is ReferenceSeriesResult.Success -> buildNormalizedIndexLookup(
                from = from,
                until = until,
                prices = equity.prices.toLookup()
            )

            is ReferenceSeriesResult.Failure -> TreeMap()
        }
        val bondLookup = when (bond) {
            is ReferenceSeriesResult.Success -> buildNormalizedIndexLookup(
                from = from,
                until = until,
                prices = bond.prices.toLookup()
            )

            is ReferenceSeriesResult.Failure -> TreeMap()
        }
        val targetMixLookup = buildTargetMixIndexLookup(
            from = from,
            until = until,
            targets = targets,
            equityBenchmark = equityLookup,
            bondBenchmark = bondLookup
        )

        BenchmarkLoads(
            equityBenchmark = equityLookup,
            inflationBenchmark = inflation.lookup,
            targetMixBenchmark = targetMixLookup.lookup,
            issueCount = listOf(
                if (equity is ReferenceSeriesResult.Failure) 1 else 0,
                inflation.issueCount,
                targetMixLookup.issueCount
            ).sum()
        )
    }

    private suspend fun loadInflationBenchmark(
        from: LocalDate,
        until: LocalDate
    ): InflationBenchmarkLoad {
        val firstMonth = YearMonth.from(from)
        val requestedUntil = latestCompletePortfolioMonthExclusive(until)
        if (!firstMonth.isBefore(requestedUntil)) {
            return InflationBenchmarkLoad(
                lookup = buildFlatIndexLookup(from = from, until = until),
                issueCount = 0
            )
        }
        val series = loadMonthlyInflationSeriesWithFallback(firstMonth, requestedUntil)
            ?: return InflationBenchmarkLoad(
                lookup = TreeMap(),
                issueCount = 1
            )
        if (series.points.isEmpty()) {
            return InflationBenchmarkLoad(
                lookup = buildFlatIndexLookup(from = from, until = until),
                issueCount = 0
            )
        }
        val monthlyMultipliers = linkedMapOf<YearMonth, BigDecimal>()
        series.points.forEach { point ->
            monthlyMultipliers[point.month] = point.multiplier
        }

        return InflationBenchmarkLoad(
            lookup = buildInflationIndexLookup(
                from = from,
                until = until,
                monthlyMultipliers = monthlyMultipliers,
                availableUntil = series.until
            ),
            issueCount = 0
        )
    }

    private suspend fun loadMonthlyInflationSeriesWithFallback(
        from: YearMonth,
        requestedUntil: YearMonth
    ): InflationSeriesResult.Success? {
        var candidateUntil = requestedUntil
        while (candidateUntil > from) {
            when (val result = inflationAdjustmentProvider.monthlySeries(from, candidateUntil)) {
                is InflationSeriesResult.Success -> return result
                is InflationSeriesResult.Failure -> candidateUntil = candidateUntil.minusMonths(1)
            }
        }
        return null
    }

    private fun attachBenchmarkIndices(
        points: List<PortfolioDailyHistoryPoint>,
        benchmarkLoads: BenchmarkLoads
    ): List<PortfolioDailyHistoryPoint> {
        val portfolioPerformanceLookup = buildPortfolioPerformanceIndex(points)

        return points.map { point ->
            point.copy(
                portfolioPerformanceIndex = portfolioPerformanceLookup.lookupOn(point.date),
                equityBenchmarkIndex = benchmarkLoads.equityBenchmark.lookupOn(point.date),
                inflationBenchmarkIndex = benchmarkLoads.inflationBenchmark.lookupOn(point.date),
                targetMixBenchmarkIndex = benchmarkLoads.targetMixBenchmark.lookupOn(point.date)
            )
        }
    }

    private fun buildPortfolioPerformanceIndex(
        points: List<PortfolioDailyHistoryPoint>
    ): TreeMap<LocalDate, BigDecimal> {
        val lookup = TreeMap<LocalDate, BigDecimal>()
        if (points.isEmpty()) {
            return lookup
        }

        var currentIndex: BigDecimal? = null
        var previousPoint: PortfolioDailyHistoryPoint? = null

        points.forEach { point ->
            when {
                currentIndex == null && point.totalCurrentValuePln.signum() > 0 -> {
                    currentIndex = BASE_INDEX
                    lookup[point.date] = BASE_INDEX
                }

                currentIndex != null && previousPoint != null -> {
                    val previous = previousPoint
                    val index = currentIndex
                    val previousValue = previous.totalCurrentValuePln
                    val externalFlow = point.netContributionsPln.subtract(previous.netContributionsPln)
                    if (previousValue.signum() > 0) {
                        val dailyFactor = point.totalCurrentValuePln
                            .subtract(externalFlow)
                            .divide(previousValue, 12, RoundingMode.HALF_UP)

                        if (dailyFactor.signum() >= 0) {
                            currentIndex = index
                                .multiply(dailyFactor, MONEY_CONTEXT)
                                .index()
                            lookup[point.date] = currentIndex
                        }
                    }
                }
            }

            previousPoint = point
        }

        return lookup
    }

    private fun buildNormalizedIndexLookup(
        from: LocalDate,
        until: LocalDate,
        prices: TreeMap<LocalDate, BigDecimal>
    ): TreeMap<LocalDate, BigDecimal> {
        val basePrice = prices.floorEntry(from)?.value ?: prices.ceilingEntry(from)?.value ?: return TreeMap()
        val lookup = TreeMap<LocalDate, BigDecimal>()

        var date = from
        while (!date.isAfter(until)) {
            prices.floorEntry(date)?.value?.let { price ->
                lookup[date] = price
                    .divide(basePrice, 12, RoundingMode.HALF_UP)
                    .multiply(BigDecimal(100), MONEY_CONTEXT)
                    .index()
            }
            date = date.plusDays(1)
        }

        return lookup
    }

    private fun buildInflationIndexLookup(
        from: LocalDate,
        until: LocalDate,
        monthlyMultipliers: Map<YearMonth, BigDecimal>,
        availableUntil: YearMonth
    ): TreeMap<LocalDate, BigDecimal> {
        val lookup = TreeMap<LocalDate, BigDecimal>()
        var index = BASE_INDEX
        lookup[from] = index

        var date = from.plusDays(1)
        while (!date.isAfter(until)) {
            val month = YearMonth.from(date)
            if (month.isBefore(availableUntil)) {
                val monthlyMultiplier = monthlyMultipliers[month]
                if (monthlyMultiplier != null && monthlyMultiplier.signum() > 0) {
                    val dailyFactor = monthlyMultiplier.toDouble().pow(1.0 / month.lengthOfMonth().toDouble())
                    index = BigDecimal.valueOf(index.toDouble() * dailyFactor).index()
                }
            }
            lookup[date] = index
            date = date.plusDays(1)
        }

        return lookup
    }

    private fun buildTargetMixIndexLookup(
        from: LocalDate,
        until: LocalDate,
        targets: List<net.bobinski.portfolio.api.domain.model.PortfolioTarget>,
        equityBenchmark: TreeMap<LocalDate, BigDecimal>,
        bondBenchmark: TreeMap<LocalDate, BigDecimal>
    ): TargetMixBenchmarkLoad {
        if (targets.isEmpty()) {
            return TargetMixBenchmarkLoad(lookup = TreeMap(), issueCount = 0)
        }

        val weightsByAssetClass = targets.associate { target -> target.assetClass to target.targetWeight.toDouble() }
        val equityWeight = weightsByAssetClass[AssetClass.EQUITIES] ?: 0.0
        val bondWeight = weightsByAssetClass[AssetClass.BONDS] ?: 0.0
        val cashWeight = weightsByAssetClass[AssetClass.CASH] ?: 0.0

        val effectiveFromCandidates = mutableListOf(from)
        if (equityWeight > 0.0) {
            val firstEquityDate = equityBenchmark.firstEntry()?.key ?: return TargetMixBenchmarkLoad(lookup = TreeMap(), issueCount = 1)
            effectiveFromCandidates += firstEquityDate
        }
        if (bondWeight > 0.0) {
            val firstBondDate = bondBenchmark.firstEntry()?.key ?: return TargetMixBenchmarkLoad(lookup = TreeMap(), issueCount = 1)
            effectiveFromCandidates += firstBondDate
        }

        val effectiveFrom = effectiveFromCandidates.maxOrNull() ?: from
        if (effectiveFrom.isAfter(until)) {
            return TargetMixBenchmarkLoad(lookup = TreeMap(), issueCount = 1)
        }

        val lookup = TreeMap<LocalDate, BigDecimal>()
        var index = BASE_INDEX
        lookup[effectiveFrom] = index
        var previousDate = effectiveFrom
        var date = effectiveFrom.plusDays(1)

        while (!date.isAfter(until)) {
            val equityFactor = dailyIndexFactor(
                lookup = equityBenchmark,
                previousDate = previousDate,
                currentDate = date,
                weight = equityWeight
            ) ?: return TargetMixBenchmarkLoad(lookup = TreeMap(), issueCount = 1)
            val bondFactor = dailyIndexFactor(
                lookup = bondBenchmark,
                previousDate = previousDate,
                currentDate = date,
                weight = bondWeight
            ) ?: return TargetMixBenchmarkLoad(lookup = TreeMap(), issueCount = 1)

            val mixFactor = 1.0 +
                equityWeight * (equityFactor - 1.0) +
                bondWeight * (bondFactor - 1.0) +
                cashWeight * 0.0
            index = BigDecimal.valueOf(index.toDouble() * mixFactor).index()
            lookup[date] = index

            previousDate = date
            date = date.plusDays(1)
        }

        return TargetMixBenchmarkLoad(lookup = lookup, issueCount = 0)
    }

    private fun dailyIndexFactor(
        lookup: TreeMap<LocalDate, BigDecimal>,
        previousDate: LocalDate,
        currentDate: LocalDate,
        weight: Double
    ): Double? {
        if (weight == 0.0) {
            return 1.0
        }

        val previousValue = lookup.lookupOn(previousDate) ?: return null
        val currentValue = lookup.lookupOn(currentDate) ?: return null
        if (previousValue.signum() == 0) {
            return null
        }

        return currentValue.divide(previousValue, 12, RoundingMode.HALF_UP).toDouble()
    }

    private fun buildFlatIndexLookup(
        from: LocalDate,
        until: LocalDate
    ): TreeMap<LocalDate, BigDecimal> {
        val lookup = TreeMap<LocalDate, BigDecimal>()
        var date = from
        while (!date.isAfter(until)) {
            lookup[date] = BASE_INDEX
            date = date.plusDays(1)
        }
        return lookup
    }

    private fun latestCompletePortfolioMonthExclusive(date: LocalDate): YearMonth =
        if (date.dayOfMonth == date.lengthOfMonth()) {
            YearMonth.from(date).plusMonths(1)
        } else {
            YearMonth.from(date)
        }

    private fun List<HistoricalPricePoint>.toLookup(): TreeMap<LocalDate, BigDecimal> =
        associateTo(TreeMap()) { it.date to it.closePricePln.money() }

    private fun HistoricalLoads.priceLookup(instrumentId: UUID): TreeMap<LocalDate, BigDecimal> =
        lookups[instrumentId] ?: TreeMap()

    private fun HistoricalLoads.priceLookup(lotKey: EdoLotKey): TreeMap<LocalDate, BigDecimal> =
        edoLotLookups[lotKey] ?: TreeMap()

    private fun TreeMap<LocalDate, BigDecimal>.lookupOn(date: LocalDate): BigDecimal? =
        floorEntry(date)?.value

    private fun MutableHolding.isValuedOn(date: LocalDate, historyLoads: HistoricalLoads): Boolean =
        if (instrument.kind == InstrumentKind.BOND_EDO) {
            edoLots
                .filter { it.quantity.signum() > 0 }
                .all { lot -> historyLoads.priceLookup(EdoLotKey(instrument.id, lot.purchaseDate)).floorEntry(date)?.value != null }
        } else {
            historyLoads.priceLookup(instrument.id).floorEntry(date)?.value != null
        }

    private fun MutableHolding.currentValueOn(date: LocalDate, historyLoads: HistoricalLoads): BigDecimal {
        if (instrument.kind == InstrumentKind.BOND_EDO) {
            return edoLots
                .filter { it.quantity.signum() > 0 }
                .fold(BigDecimal.ZERO) { total, lot ->
                    val price = historyLoads.priceLookup(EdoLotKey(instrument.id, lot.purchaseDate)).floorEntry(date)?.value
                    val lotValue = if (price != null) {
                        price.multiply(lot.quantity, MONEY_CONTEXT)
                    } else {
                        lot.costBasisPln
                    }
                    total.add(lotValue, MONEY_CONTEXT)
                }
                .money()
        }
        val price = historyLoads.priceLookup(instrument.id).floorEntry(date)?.value
        return if (price != null) {
            price.multiply(quantity, MONEY_CONTEXT).money()
        } else {
            costBasisPln.money()
        }
    }

    private fun MutableHolding.addEdoLot(
        purchaseDate: LocalDate,
        quantity: BigDecimal,
        costBasisPln: BigDecimal
    ) {
        if (quantity.signum() <= 0) {
            return
        }
        edoLots += EdoHoldingLot(
            purchaseDate = purchaseDate,
            quantity = quantity,
            costBasisPln = costBasisPln
        )
        syncFromEdoLots()
    }

    private fun MutableHolding.reduceEdoLotsFifo(quantityToReduce: BigDecimal) {
        if (quantityToReduce.signum() <= 0) {
            return
        }
        var remaining = quantityToReduce
        val iterator = edoLots.iterator()
        while (iterator.hasNext() && remaining.signum() > 0) {
            val lot = iterator.next()
            if (lot.quantity.signum() <= 0) {
                iterator.remove()
                continue
            }
            val consumed = remaining.min(lot.quantity)
            val reducedCostBasis = if (consumed >= lot.quantity) {
                lot.costBasisPln
            } else {
                lot.costBasisPln
                    .divide(lot.quantity, 12, RoundingMode.HALF_UP)
                    .multiply(consumed, MONEY_CONTEXT)
            }
            lot.quantity = lot.quantity.subtract(consumed, MONEY_CONTEXT).max(BigDecimal.ZERO)
            lot.costBasisPln = lot.costBasisPln.subtract(reducedCostBasis, MONEY_CONTEXT).max(BigDecimal.ZERO)
            if (lot.quantity.signum() == 0) {
                iterator.remove()
            }
            remaining = remaining.subtract(consumed, MONEY_CONTEXT).max(BigDecimal.ZERO)
        }
        syncFromEdoLots()
    }

    private fun MutableHolding.syncFromEdoLots() {
        quantity = edoLots.fold(BigDecimal.ZERO) { total, lot -> total.add(lot.quantity, MONEY_CONTEXT) }
        costBasisPln = edoLots.fold(BigDecimal.ZERO) { total, lot -> total.add(lot.costBasisPln, MONEY_CONTEXT) }
    }

    private fun BigDecimal.money(): BigDecimal = setScale(2, RoundingMode.HALF_UP)

    private fun BigDecimal.index(): BigDecimal = setScale(4, RoundingMode.HALF_UP).stripTrailingZeros()

    private fun BigDecimal.divideBy(
        lookup: TreeMap<LocalDate, BigDecimal>,
        date: LocalDate
    ): BigDecimal? {
        val divisor = lookup.referencePriceOn(date)
        if (divisor == null || divisor.signum() == 0) {
            return null
        }
        return divide(divisor, 8, RoundingMode.HALF_UP).scaledReferenceUnits()
    }

    private fun BigDecimal.addReferenceUnits(
        amountPln: BigDecimal,
        lookup: TreeMap<LocalDate, BigDecimal>,
        date: LocalDate
    ): BigDecimal {
        val units = amountPln.divideBy(lookup, date) ?: return this
        return add(units, MONEY_CONTEXT)
    }

    private fun BigDecimal.subtractReferenceUnits(
        amountPln: BigDecimal,
        lookup: TreeMap<LocalDate, BigDecimal>,
        date: LocalDate
    ): BigDecimal {
        val units = amountPln.divideBy(lookup, date) ?: return this
        return subtract(units, MONEY_CONTEXT)
    }

    private fun BigDecimal.referenceUnits(): BigDecimal =
        scaledReferenceUnits()

    private fun BigDecimal.scaledReferenceUnits(): BigDecimal {
        val normalized = setScale(8, RoundingMode.HALF_UP).stripTrailingZeros()
        return if (normalized.scale() < 0) {
            normalized.setScale(0)
        } else {
            normalized
        }
    }

    private fun TreeMap<LocalDate, BigDecimal>.referencePriceOn(date: LocalDate): BigDecimal? =
        floorEntry(date)?.value ?: ceilingEntry(date)?.value

    private fun BigDecimal.ratioOf(part: BigDecimal): BigDecimal =
        if (signum() <= 0 || part.signum() <= 0) {
            BigDecimal.ZERO.money()
        } else {
            part.divide(this, 6, RoundingMode.HALF_UP)
                .multiply(BigDecimal(100), MONEY_CONTEXT)
                .money()
        }

    private data class HoldingKey(
        val accountId: UUID,
        val instrumentId: UUID
    )

    private data class MutableHolding(
        val account: Account,
        val instrument: Instrument,
        var quantity: BigDecimal = BigDecimal.ZERO,
        var costBasisPln: BigDecimal = BigDecimal.ZERO,
        val edoLots: MutableList<EdoHoldingLot> = mutableListOf(),
        var transactionCount: Int = 0
    )

    private data class HistoricalLoads(
        val lookups: Map<UUID, TreeMap<LocalDate, BigDecimal>>,
        val edoLotLookups: Map<EdoLotKey, TreeMap<LocalDate, BigDecimal>>,
        val issueCount: Int,
        val valuationState: ValuationState
    )

    private data class EdoHoldingLot(
        val purchaseDate: LocalDate,
        var quantity: BigDecimal,
        var costBasisPln: BigDecimal
    )

    private data class EdoLotKey(
        val instrumentId: UUID,
        val purchaseDate: LocalDate
    )

    private data class ReferenceLoads(
        val usdPln: TreeMap<LocalDate, BigDecimal>,
        val goldPln: TreeMap<LocalDate, BigDecimal>,
        val issueCount: Int
    )

    private data class BenchmarkLoads(
        val equityBenchmark: TreeMap<LocalDate, BigDecimal>,
        val inflationBenchmark: TreeMap<LocalDate, BigDecimal>,
        val targetMixBenchmark: TreeMap<LocalDate, BigDecimal>,
        val issueCount: Int
    )

    private data class InflationBenchmarkLoad(
        val lookup: TreeMap<LocalDate, BigDecimal>,
        val issueCount: Int
    )

    private data class TargetMixBenchmarkLoad(
        val lookup: TreeMap<LocalDate, BigDecimal>,
        val issueCount: Int
    )

    private companion object {
        val MONEY_CONTEXT: MathContext = MathContext.DECIMAL64
        val BASE_INDEX: BigDecimal = BigDecimal("100.0000")
    }
}

data class PortfolioDailyHistory(
    val from: LocalDate,
    val until: LocalDate,
    val valuationState: ValuationState,
    val instrumentHistoryIssueCount: Int,
    val referenceSeriesIssueCount: Int,
    val benchmarkSeriesIssueCount: Int,
    val missingFxTransactions: Int,
    val unsupportedCorrectionTransactions: Int,
    val points: List<PortfolioDailyHistoryPoint>
)

data class PortfolioDailyHistoryPoint(
    val date: LocalDate,
    val totalBookValuePln: BigDecimal,
    val totalCurrentValuePln: BigDecimal,
    val netContributionsPln: BigDecimal,
    val cashBalancePln: BigDecimal,
    val totalCurrentValueUsd: BigDecimal?,
    val netContributionsUsd: BigDecimal?,
    val cashBalanceUsd: BigDecimal?,
    val totalCurrentValueAu: BigDecimal?,
    val netContributionsAu: BigDecimal?,
    val cashBalanceAu: BigDecimal?,
    val equityCurrentValuePln: BigDecimal,
    val bondCurrentValuePln: BigDecimal,
    val cashCurrentValuePln: BigDecimal,
    val equityAllocationPct: BigDecimal,
    val bondAllocationPct: BigDecimal,
    val cashAllocationPct: BigDecimal,
    val portfolioPerformanceIndex: BigDecimal?,
    val equityBenchmarkIndex: BigDecimal?,
    val inflationBenchmarkIndex: BigDecimal?,
    val targetMixBenchmarkIndex: BigDecimal?,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int
)
