package net.bobinski.portfolio.api.route

import io.ktor.server.response.respond
import io.ktor.server.request.receive
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import net.bobinski.portfolio.api.domain.service.HoldingSnapshot
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistory
import net.bobinski.portfolio.api.domain.service.PortfolioDailyHistoryPoint
import net.bobinski.portfolio.api.domain.service.PortfolioHistoryService
import net.bobinski.portfolio.api.domain.service.PortfolioImportIssue
import net.bobinski.portfolio.api.domain.service.PortfolioOverview
import net.bobinski.portfolio.api.domain.service.PortfolioReadModelService
import net.bobinski.portfolio.api.domain.service.PortfolioReturnPeriod
import net.bobinski.portfolio.api.domain.service.PortfolioReturns
import net.bobinski.portfolio.api.domain.service.PortfolioReturnsService
import net.bobinski.portfolio.api.domain.service.PortfolioImportPreview
import net.bobinski.portfolio.api.domain.service.PortfolioSnapshot
import net.bobinski.portfolio.api.domain.service.PortfolioTransferService
import net.bobinski.portfolio.api.domain.service.PortfolioImportRequest
import net.bobinski.portfolio.api.domain.service.ImportMode
import net.bobinski.portfolio.api.domain.service.ReturnMetric
import org.koin.ktor.ext.inject

fun Route.portfolioRoute() {
    val portfolioReadModelService: PortfolioReadModelService by inject()
    val portfolioHistoryService: PortfolioHistoryService by inject()
    val portfolioReturnsService: PortfolioReturnsService by inject()
    val portfolioTransferService: PortfolioTransferService by inject()

    route("/v1/portfolio") {
        get("/overview") {
            call.respond(portfolioReadModelService.overview().toResponse())
        }

        get("/holdings") {
            call.respond(portfolioReadModelService.holdings().map { it.toResponse() })
        }

        get("/history/daily") {
            call.respond(portfolioHistoryService.dailyHistory().toResponse())
        }

        get("/returns") {
            call.respond(portfolioReturnsService.returns().toResponse())
        }

        get("/state/export") {
            call.respond(portfolioTransferService.exportState().toResponse())
        }

        post("/state/preview") {
            val request = call.receive<ImportPortfolioStateRequest>()
            val result = portfolioTransferService.previewImport(request.toDomain())
            call.respond(result.toResponse())
        }

        post("/state/import") {
            val request = call.receive<ImportPortfolioStateRequest>()
            val result = portfolioTransferService.importState(request.toDomain())
            call.respond(result.toResponse())
        }
    }
}

@Serializable
data class PortfolioOverviewResponse(
    val asOf: String,
    val valuationState: String,
    val totalBookValuePln: String,
    val totalCurrentValuePln: String,
    val investedBookValuePln: String,
    val investedCurrentValuePln: String,
    val cashBalancePln: String,
    val netContributionsPln: String,
    val equityBookValuePln: String,
    val equityCurrentValuePln: String,
    val bondBookValuePln: String,
    val bondCurrentValuePln: String,
    val cashBookValuePln: String,
    val cashCurrentValuePln: String,
    val totalUnrealizedGainPln: String,
    val accountCount: Int,
    val instrumentCount: Int,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int,
    val unvaluedHoldingCount: Int,
    val valuationIssueCount: Int,
    val missingFxTransactions: Int,
    val unsupportedCorrectionTransactions: Int
)

@Serializable
data class HoldingResponse(
    val accountId: String,
    val accountName: String,
    val instrumentId: String,
    val instrumentName: String,
    val kind: String,
    val assetClass: String,
    val currency: String,
    val quantity: String,
    val averageCostPerUnitPln: String,
    val costBasisPln: String,
    val bookValuePln: String,
    val currentPricePln: String?,
    val currentValuePln: String?,
    val unrealizedGainPln: String?,
    val valuedAt: String?,
    val valuationStatus: String,
    val valuationIssue: String?,
    val transactionCount: Int
)

@Serializable
data class PortfolioDailyHistoryResponse(
    val from: String,
    val until: String,
    val valuationState: String,
    val instrumentHistoryIssueCount: Int,
    val referenceSeriesIssueCount: Int,
    val missingFxTransactions: Int,
    val unsupportedCorrectionTransactions: Int,
    val points: List<PortfolioDailyHistoryPointResponse>
)

@Serializable
data class PortfolioDailyHistoryPointResponse(
    val date: String,
    val totalBookValuePln: String,
    val totalCurrentValuePln: String,
    val netContributionsPln: String,
    val cashBalancePln: String,
    val totalCurrentValueUsd: String?,
    val netContributionsUsd: String?,
    val cashBalanceUsd: String?,
    val totalCurrentValueAu: String?,
    val netContributionsAu: String?,
    val cashBalanceAu: String?,
    val equityCurrentValuePln: String,
    val bondCurrentValuePln: String,
    val cashCurrentValuePln: String,
    val equityAllocationPct: String,
    val bondAllocationPct: String,
    val cashAllocationPct: String,
    val activeHoldingCount: Int,
    val valuedHoldingCount: Int
)

@Serializable
data class PortfolioReturnsResponse(
    val asOf: String,
    val periods: List<PortfolioReturnPeriodResponse>
)

@Serializable
data class PortfolioReturnPeriodResponse(
    val key: String,
    val label: String,
    val requestedFrom: String,
    val from: String,
    val until: String,
    val clippedToInception: Boolean,
    val dayCount: Long,
    val nominalPln: ReturnMetricResponse?,
    val nominalUsd: ReturnMetricResponse?,
    val realPln: ReturnMetricResponse?,
    val inflationFrom: String?,
    val inflationUntil: String?,
    val inflationMultiplier: String?
)

@Serializable
data class ReturnMetricResponse(
    val moneyWeightedReturn: String,
    val annualizedMoneyWeightedReturn: String?
)

@Serializable
data class PortfolioSnapshotResponse(
    val schemaVersion: Int,
    val exportedAt: String,
    val accounts: List<AccountSnapshotResponse>,
    val instruments: List<InstrumentSnapshotResponse>,
    val transactions: List<TransactionSnapshotResponse>
)

@Serializable
data class AccountSnapshotResponse(
    val id: String,
    val name: String,
    val institution: String,
    val type: String,
    val baseCurrency: String,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class InstrumentSnapshotResponse(
    val id: String,
    val name: String,
    val kind: String,
    val assetClass: String,
    val symbol: String?,
    val currency: String,
    val valuationSource: String,
    val edoTerms: EdoTermsSnapshotResponse?,
    val isActive: Boolean,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class EdoTermsSnapshotResponse(
    val purchaseDate: String,
    val firstPeriodRateBps: Int,
    val marginBps: Int,
    val principalUnits: Int,
    val maturityDate: String
)

@Serializable
data class TransactionSnapshotResponse(
    val id: String,
    val accountId: String,
    val instrumentId: String?,
    val type: String,
    val tradeDate: String,
    val settlementDate: String?,
    val quantity: String?,
    val unitPrice: String?,
    val grossAmount: String,
    val feeAmount: String,
    val taxAmount: String,
    val currency: String,
    val fxRateToPln: String?,
    val notes: String,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class ImportPortfolioStateRequest(
    val mode: String = "MERGE",
    val snapshot: PortfolioSnapshotResponse
)

@Serializable
data class PortfolioImportResultResponse(
    val mode: String,
    val accountCount: Int,
    val instrumentCount: Int,
    val transactionCount: Int
)

@Serializable
data class PortfolioImportPreviewResponse(
    val mode: String,
    val schemaVersion: Int,
    val isValid: Boolean,
    val snapshotAccountCount: Int,
    val snapshotInstrumentCount: Int,
    val snapshotTransactionCount: Int,
    val existingAccountCount: Int,
    val existingInstrumentCount: Int,
    val existingTransactionCount: Int,
    val matchingAccountCount: Int,
    val matchingInstrumentCount: Int,
    val matchingTransactionCount: Int,
    val blockingIssueCount: Int,
    val warningCount: Int,
    val issues: List<PortfolioImportIssueResponse>
)

@Serializable
data class PortfolioImportIssueResponse(
    val severity: String,
    val code: String,
    val message: String
)

private fun PortfolioOverview.toResponse(): PortfolioOverviewResponse = PortfolioOverviewResponse(
    asOf = asOf.toString(),
    valuationState = valuationState.name,
    totalBookValuePln = totalBookValuePln.toPlainString(),
    totalCurrentValuePln = totalCurrentValuePln.toPlainString(),
    investedBookValuePln = investedBookValuePln.toPlainString(),
    investedCurrentValuePln = investedCurrentValuePln.toPlainString(),
    cashBalancePln = cashBalancePln.toPlainString(),
    netContributionsPln = netContributionsPln.toPlainString(),
    equityBookValuePln = equityBookValuePln.toPlainString(),
    equityCurrentValuePln = equityCurrentValuePln.toPlainString(),
    bondBookValuePln = bondBookValuePln.toPlainString(),
    bondCurrentValuePln = bondCurrentValuePln.toPlainString(),
    cashBookValuePln = cashBookValuePln.toPlainString(),
    cashCurrentValuePln = cashCurrentValuePln.toPlainString(),
    totalUnrealizedGainPln = totalUnrealizedGainPln.toPlainString(),
    accountCount = accountCount,
    instrumentCount = instrumentCount,
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount,
    unvaluedHoldingCount = unvaluedHoldingCount,
    valuationIssueCount = valuationIssueCount,
    missingFxTransactions = missingFxTransactions,
    unsupportedCorrectionTransactions = unsupportedCorrectionTransactions
)

private fun HoldingSnapshot.toResponse(): HoldingResponse = HoldingResponse(
    accountId = accountId.toString(),
    accountName = accountName,
    instrumentId = instrumentId.toString(),
    instrumentName = instrumentName,
    kind = kind,
    assetClass = assetClass,
    currency = currency,
    quantity = quantity.toPlainString(),
    averageCostPerUnitPln = averageCostPerUnitPln.toPlainString(),
    costBasisPln = costBasisPln.toPlainString(),
    bookValuePln = bookValuePln.toPlainString(),
    currentPricePln = currentPricePln?.toPlainString(),
    currentValuePln = currentValuePln?.toPlainString(),
    unrealizedGainPln = unrealizedGainPln?.toPlainString(),
    valuedAt = valuedAt?.toString(),
    valuationStatus = valuationStatus.name,
    valuationIssue = valuationIssue,
    transactionCount = transactionCount
)

private fun PortfolioDailyHistory.toResponse(): PortfolioDailyHistoryResponse = PortfolioDailyHistoryResponse(
    from = from.toString(),
    until = until.toString(),
    valuationState = valuationState.name,
    instrumentHistoryIssueCount = instrumentHistoryIssueCount,
    referenceSeriesIssueCount = referenceSeriesIssueCount,
    missingFxTransactions = missingFxTransactions,
    unsupportedCorrectionTransactions = unsupportedCorrectionTransactions,
    points = points.map { it.toResponse() }
)

private fun PortfolioDailyHistoryPoint.toResponse(): PortfolioDailyHistoryPointResponse = PortfolioDailyHistoryPointResponse(
    date = date.toString(),
    totalBookValuePln = totalBookValuePln.toPlainString(),
    totalCurrentValuePln = totalCurrentValuePln.toPlainString(),
    netContributionsPln = netContributionsPln.toPlainString(),
    cashBalancePln = cashBalancePln.toPlainString(),
    totalCurrentValueUsd = totalCurrentValueUsd?.toPlainString(),
    netContributionsUsd = netContributionsUsd?.toPlainString(),
    cashBalanceUsd = cashBalanceUsd?.toPlainString(),
    totalCurrentValueAu = totalCurrentValueAu?.toPlainString(),
    netContributionsAu = netContributionsAu?.toPlainString(),
    cashBalanceAu = cashBalanceAu?.toPlainString(),
    equityCurrentValuePln = equityCurrentValuePln.toPlainString(),
    bondCurrentValuePln = bondCurrentValuePln.toPlainString(),
    cashCurrentValuePln = cashCurrentValuePln.toPlainString(),
    equityAllocationPct = equityAllocationPct.toPlainString(),
    bondAllocationPct = bondAllocationPct.toPlainString(),
    cashAllocationPct = cashAllocationPct.toPlainString(),
    activeHoldingCount = activeHoldingCount,
    valuedHoldingCount = valuedHoldingCount
)

private fun PortfolioReturns.toResponse(): PortfolioReturnsResponse = PortfolioReturnsResponse(
    asOf = asOf.toString(),
    periods = periods.map { it.toResponse() }
)

private fun PortfolioReturnPeriod.toResponse(): PortfolioReturnPeriodResponse = PortfolioReturnPeriodResponse(
    key = key.name,
    label = label,
    requestedFrom = requestedFrom.toString(),
    from = from.toString(),
    until = until.toString(),
    clippedToInception = clippedToInception,
    dayCount = dayCount,
    nominalPln = nominalPln?.toResponse(),
    nominalUsd = nominalUsd?.toResponse(),
    realPln = realPln?.toResponse(),
    inflationFrom = inflation?.from?.toString(),
    inflationUntil = inflation?.until?.toString(),
    inflationMultiplier = inflation?.multiplier?.toPlainString()
)

private fun ReturnMetric.toResponse(): ReturnMetricResponse = ReturnMetricResponse(
    moneyWeightedReturn = moneyWeightedReturn.toPlainString(),
    annualizedMoneyWeightedReturn = annualizedMoneyWeightedReturn?.toPlainString()
)

private fun PortfolioSnapshot.toResponse(): PortfolioSnapshotResponse = PortfolioSnapshotResponse(
    schemaVersion = schemaVersion,
    exportedAt = exportedAt.toString(),
    accounts = accounts.map { snapshot ->
        AccountSnapshotResponse(
            id = snapshot.id,
            name = snapshot.name,
            institution = snapshot.institution,
            type = snapshot.type,
            baseCurrency = snapshot.baseCurrency,
            isActive = snapshot.isActive,
            createdAt = snapshot.createdAt,
            updatedAt = snapshot.updatedAt
        )
    },
    instruments = instruments.map { snapshot ->
        InstrumentSnapshotResponse(
            id = snapshot.id,
            name = snapshot.name,
            kind = snapshot.kind,
            assetClass = snapshot.assetClass,
            symbol = snapshot.symbol,
            currency = snapshot.currency,
            valuationSource = snapshot.valuationSource,
            edoTerms = snapshot.edoTerms?.let { terms ->
                EdoTermsSnapshotResponse(
                    purchaseDate = terms.purchaseDate,
                    firstPeriodRateBps = terms.firstPeriodRateBps,
                    marginBps = terms.marginBps,
                    principalUnits = terms.principalUnits,
                    maturityDate = terms.maturityDate
                )
            },
            isActive = snapshot.isActive,
            createdAt = snapshot.createdAt,
            updatedAt = snapshot.updatedAt
        )
    },
    transactions = transactions.map { snapshot ->
        TransactionSnapshotResponse(
            id = snapshot.id,
            accountId = snapshot.accountId,
            instrumentId = snapshot.instrumentId,
            type = snapshot.type,
            tradeDate = snapshot.tradeDate,
            settlementDate = snapshot.settlementDate,
            quantity = snapshot.quantity,
            unitPrice = snapshot.unitPrice,
            grossAmount = snapshot.grossAmount,
            feeAmount = snapshot.feeAmount,
            taxAmount = snapshot.taxAmount,
            currency = snapshot.currency,
            fxRateToPln = snapshot.fxRateToPln,
            notes = snapshot.notes,
            createdAt = snapshot.createdAt,
            updatedAt = snapshot.updatedAt
        )
    }
)

private fun ImportPortfolioStateRequest.toDomain(): PortfolioImportRequest = PortfolioImportRequest(
    mode = try {
        ImportMode.valueOf(mode)
    } catch (_: IllegalArgumentException) {
        throw IllegalArgumentException("mode must be one of ${ImportMode.entries.joinToString()}.")
    },
    snapshot = PortfolioSnapshot(
        schemaVersion = snapshot.schemaVersion,
        exportedAt = snapshot.exportedAt.toInstantOrThrow("snapshot.exportedAt"),
        accounts = snapshot.accounts.map { account ->
            net.bobinski.portfolio.api.domain.service.AccountSnapshot(
                id = account.id,
                name = account.name,
                institution = account.institution,
                type = account.type,
                baseCurrency = account.baseCurrency,
                isActive = account.isActive,
                createdAt = account.createdAt,
                updatedAt = account.updatedAt
            )
        },
        instruments = snapshot.instruments.map { instrument ->
            net.bobinski.portfolio.api.domain.service.InstrumentSnapshot(
                id = instrument.id,
                name = instrument.name,
                kind = instrument.kind,
                assetClass = instrument.assetClass,
                symbol = instrument.symbol,
                currency = instrument.currency,
                valuationSource = instrument.valuationSource,
                edoTerms = instrument.edoTerms?.let { terms ->
                    net.bobinski.portfolio.api.domain.service.EdoTermsSnapshot(
                        purchaseDate = terms.purchaseDate,
                        firstPeriodRateBps = terms.firstPeriodRateBps,
                        marginBps = terms.marginBps,
                        principalUnits = terms.principalUnits,
                        maturityDate = terms.maturityDate
                    )
                },
                isActive = instrument.isActive,
                createdAt = instrument.createdAt,
                updatedAt = instrument.updatedAt
            )
        },
        transactions = snapshot.transactions.map { transaction ->
            net.bobinski.portfolio.api.domain.service.TransactionSnapshot(
                id = transaction.id,
                accountId = transaction.accountId,
                instrumentId = transaction.instrumentId,
                type = transaction.type,
                tradeDate = transaction.tradeDate,
                settlementDate = transaction.settlementDate,
                quantity = transaction.quantity,
                unitPrice = transaction.unitPrice,
                grossAmount = transaction.grossAmount,
                feeAmount = transaction.feeAmount,
                taxAmount = transaction.taxAmount,
                currency = transaction.currency,
                fxRateToPln = transaction.fxRateToPln,
                notes = transaction.notes,
                createdAt = transaction.createdAt,
                updatedAt = transaction.updatedAt
            )
        }
    )
)

private fun net.bobinski.portfolio.api.domain.service.PortfolioImportResult.toResponse(): PortfolioImportResultResponse =
    PortfolioImportResultResponse(
        mode = mode.name,
        accountCount = accountCount,
        instrumentCount = instrumentCount,
        transactionCount = transactionCount
    )

private fun PortfolioImportPreview.toResponse(): PortfolioImportPreviewResponse =
    PortfolioImportPreviewResponse(
        mode = mode.name,
        schemaVersion = schemaVersion,
        isValid = isValid,
        snapshotAccountCount = snapshotAccountCount,
        snapshotInstrumentCount = snapshotInstrumentCount,
        snapshotTransactionCount = snapshotTransactionCount,
        existingAccountCount = existingAccountCount,
        existingInstrumentCount = existingInstrumentCount,
        existingTransactionCount = existingTransactionCount,
        matchingAccountCount = matchingAccountCount,
        matchingInstrumentCount = matchingInstrumentCount,
        matchingTransactionCount = matchingTransactionCount,
        blockingIssueCount = blockingIssueCount,
        warningCount = warningCount,
        issues = issues.map(PortfolioImportIssue::toResponse)
    )

private fun PortfolioImportIssue.toResponse(): PortfolioImportIssueResponse = PortfolioImportIssueResponse(
    severity = severity.name,
    code = code,
    message = message
)

private fun String.toInstantOrThrow(field: String): java.time.Instant = try {
    java.time.Instant.parse(this)
} catch (_: java.time.format.DateTimeParseException) {
    throw IllegalArgumentException("$field must use ISO-8601 instant format.")
}
