package net.bobinski.portfolio.api.marketdata.client

import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.parser.OpenAPIV3Parser
import io.swagger.v3.parser.core.models.ParseOptions
import kotlinx.serialization.descriptors.SerialDescriptor
import net.bobinski.portfolio.api.marketdata.contract.generated.EdoCalculatorApiErrorResponsePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.EdoCalculatorContractPaths
import net.bobinski.portfolio.api.marketdata.contract.generated.EdoCalculatorEdoResponsePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystApiErrorPayload
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystContractPaths
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystDataProvenancePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystQuotePayload
import net.bobinski.portfolio.api.marketdata.contract.generated.StockAnalystStockHistoryPayload
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.nio.file.Path

class UpstreamOpenApiConsumerContractTest {

    @Test
    fun `generated paths resolve to the pinned versioned operations`() {
        val stockAnalyst = parseContract("stock-analyst-v1.json")
        val edoCalculator = parseContract("edo-calculator-v1.yaml")

        assertEquals(StockAnalystContractPaths.QUOTE, stockAnalyst.pathFor("getQuote"))
        assertEquals(StockAnalystContractPaths.HISTORY, stockAnalyst.pathFor("getStockHistory"))
        assertEquals(EdoCalculatorContractPaths.CURRENT_VALUE, edoCalculator.pathFor("getCurrentEdoValue"))
        assertEquals(EdoCalculatorContractPaths.VALUE_AT_DATE, edoCalculator.pathFor("getEdoValueAtDate"))
        assertEquals(EdoCalculatorContractPaths.HISTORY, edoCalculator.pathFor("getEdoValueHistory"))
        assertEquals(
            EdoCalculatorContractPaths.INFLATION_SINCE,
            edoCalculator.pathFor("getCumulativeInflationSince")
        )
        assertEquals(EdoCalculatorContractPaths.MONTHLY_INFLATION, edoCalculator.pathFor("getMonthlyInflation"))
    }

    @Test
    fun `generated projections retain every field consumed by Portfolio`() {
        assertEquals(
            setOf("symbol", "currency", "date", "lastPrice", "previousClose", "provenance"),
            StockAnalystQuotePayload.serializer().descriptor.elementNames()
        )
        assertEquals(
            setOf("prices", "provenance"),
            StockAnalystStockHistoryPayload.serializer().descriptor.elementNames()
        )
        assertEquals(
            setOf(
                "source",
                "retrievedAt",
                "marketTimestamp",
                "marketDate",
                "currency",
                "unitScale",
                "adjustment",
                "coverageFrom",
                "coverageTo",
                "status"
            ),
            StockAnalystDataProvenancePayload.serializer().descriptor.elementNames()
        )
        assertEquals(
            setOf("error", "errorCode", "retryable", "requestId"),
            StockAnalystApiErrorPayload.serializer().descriptor.elementNames()
        )
        assertEquals(
            setOf("asOf", "edoValue"),
            EdoCalculatorEdoResponsePayload.serializer().descriptor.elementNames()
        )
        assertEquals(
            setOf("error", "errorCode", "retryable", "requestId"),
            EdoCalculatorApiErrorResponsePayload.serializer().descriptor.elementNames()
        )
    }

    @Test
    fun `error contracts and caller timeout margins remain explicit`() {
        val stockAnalyst = parseContract("stock-analyst-v1.json")
        val edoCalculator = parseContract("edo-calculator-v1.yaml")

        assertEquals(
            setOf("error", "errorCode", "retryable", "requestId"),
            stockAnalyst.schemaProperties("ApiError")
        )
        assertEquals(
            setOf(
                "source",
                "retrievedAt",
                "marketTimestamp",
                "marketDate",
                "currency",
                "unitScale",
                "adjustment",
                "coverageFrom",
                "coverageTo",
                "status"
            ),
            stockAnalyst.schemaProperties("DataProvenance")
        )
        assertTrue(stockAnalyst.components.schemas["Quote"]!!.required.contains("provenance"))
        assertTrue(stockAnalyst.components.schemas["StockHistory"]!!.required.contains("provenance"))
        assertEquals(
            setOf("error", "errorCode", "retryable", "requestId"),
            edoCalculator.schemaProperties("ApiErrorResponse")
        )
        listOf("429", "503").forEach { status ->
            val response = requireNotNull(
                stockAnalyst.paths[StockAnalystContractPaths.QUOTE]!!.get.responses[status]
            )
            val resolved = response.`$ref`?.substringAfterLast('/')
                ?.let { requireNotNull(stockAnalyst.components.responses[it]) }
                ?: response
            assertNotNull(resolved.headers["Retry-After"], "Stock $status must declare Retry-After")
        }

        assertTrue(UpstreamTimeoutBudgets.STOCK_ANALYST.toMillis() > STOCK_ANALYST_INTERNAL_BUDGET_MS)
        assertTrue(UpstreamTimeoutBudgets.EDO_CALCULATOR.toMillis() > EDO_INTERNAL_BUDGET_MS)
    }

    private fun parseContract(fileName: String): OpenAPI {
        val path = Path.of("contracts", "upstream", fileName).toAbsolutePath().toString()
        val options = ParseOptions().apply {
            isResolve = false
            isResolveFully = false
        }
        val result = OpenAPIV3Parser().readLocation(path, null, options)
        require(result.messages.isEmpty()) {
            "Contract parser reported issues for $fileName: ${result.messages.joinToString("; ")}"
        }
        return requireNotNull(result.openAPI) { "Cannot parse $fileName." }
    }

    private fun OpenAPI.pathFor(operationId: String): String = paths.entries
        .firstNotNullOfOrNull { (path, item) ->
            path.takeIf { item.readOperations().any { operation -> operation.operationId == operationId } }
        }
        ?: error("Missing operationId $operationId")

    private fun OpenAPI.schemaProperties(schemaName: String): Set<String> =
        components.schemas[schemaName]?.properties?.keys.orEmpty()

    private fun SerialDescriptor.elementNames(): Set<String> =
        (0 until elementsCount).map(::getElementName).toSet()

    private companion object {
        const val STOCK_ANALYST_INTERNAL_BUDGET_MS = 15_000L
        const val EDO_INTERNAL_BUDGET_MS = 8_000L
    }
}
