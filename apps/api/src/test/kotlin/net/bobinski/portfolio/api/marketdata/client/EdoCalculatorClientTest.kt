package net.bobinski.portfolio.api.marketdata.client

import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import net.bobinski.portfolio.api.config.AppJsonFactory
import net.bobinski.portfolio.api.domain.model.EdoLotTerms
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.net.InetSocketAddress
import java.net.http.HttpClient
import java.time.LocalDate

class EdoCalculatorClientTest {

    @Test
    fun `unitValueInPln extracts current rate from the active period`() = runBlocking {
        val responseBody = """
            {
              "purchaseDate": "2024-03-15",
              "asOf": "2026-03-27",
              "firstPeriodRate": "6.50",
              "margin": "2.00",
              "principal": "100.00",
              "edoValue": {
                "totalValue": "115.42",
                "totalAccruedInterest": "15.42",
                "periods": [
                  {
                    "index": 1,
                    "startDate": "2024-03-15",
                    "endDate": "2025-03-15",
                    "daysInPeriod": 366,
                    "daysElapsed": 366,
                    "ratePercent": "6.50",
                    "inflationPercent": null,
                    "interestAccrued": "6.50",
                    "value": "106.50"
                  },
                  {
                    "index": 2,
                    "startDate": "2025-03-15",
                    "endDate": "2026-03-15",
                    "daysInPeriod": 365,
                    "daysElapsed": 365,
                    "ratePercent": "6.80",
                    "inflationPercent": "4.80",
                    "interestAccrued": "7.24",
                    "value": "113.74"
                  },
                  {
                    "index": 3,
                    "startDate": "2026-03-15",
                    "endDate": "2027-03-15",
                    "daysInPeriod": 365,
                    "daysElapsed": 12,
                    "ratePercent": "5.25",
                    "inflationPercent": "3.25",
                    "interestAccrued": "1.68",
                    "value": "115.42"
                  }
                ]
              }
            }
        """.trimIndent()

        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/edo/value") { exchange ->
            val bytes = responseBody.toByteArray()
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()

        try {
            val client = EdoCalculatorClient(
                httpClient = HttpClient.newBuilder().build(),
                json = AppJsonFactory.create(),
                baseUrl = "http://127.0.0.1:${server.address.port}"
            )

            val result = client.unitValueInPln(
                EdoLotTerms(
                    purchaseDate = LocalDate.of(2024, 3, 15),
                    firstPeriodRateBps = 650,
                    marginBps = 200
                )
            )

            assertEquals(BigDecimal("115.42"), result.totalValue)
            assertEquals(LocalDate.of(2026, 3, 27), result.asOf)
            assertEquals(BigDecimal("5.25"), result.currentRatePercent)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `unitValueInPln returns null rate when all periods are complete`() = runBlocking {
        val responseBody = """
            {
              "purchaseDate": "2024-03-15",
              "asOf": "2026-03-27",
              "firstPeriodRate": "6.50",
              "margin": "2.00",
              "principal": "100.00",
              "edoValue": {
                "totalValue": "113.74",
                "totalAccruedInterest": "13.74",
                "periods": [
                  {
                    "index": 1,
                    "startDate": "2024-03-15",
                    "endDate": "2025-03-15",
                    "daysInPeriod": 366,
                    "daysElapsed": 366,
                    "ratePercent": "6.50",
                    "inflationPercent": null,
                    "interestAccrued": "6.50",
                    "value": "106.50"
                  },
                  {
                    "index": 2,
                    "startDate": "2025-03-15",
                    "endDate": "2026-03-15",
                    "daysInPeriod": 365,
                    "daysElapsed": 365,
                    "ratePercent": "6.80",
                    "inflationPercent": "4.80",
                    "interestAccrued": "7.24",
                    "value": "113.74"
                  }
                ]
              }
            }
        """.trimIndent()

        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/edo/value") { exchange ->
            val bytes = responseBody.toByteArray()
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()

        try {
            val client = EdoCalculatorClient(
                httpClient = HttpClient.newBuilder().build(),
                json = AppJsonFactory.create(),
                baseUrl = "http://127.0.0.1:${server.address.port}"
            )

            val result = client.unitValueInPln(
                EdoLotTerms(
                    purchaseDate = LocalDate.of(2024, 3, 15),
                    firstPeriodRateBps = 650,
                    marginBps = 200
                )
            )

            assertEquals(BigDecimal("113.74"), result.totalValue)
            assertNull(result.currentRatePercent)
        } finally {
            server.stop(0)
        }
    }

    @Test
    fun `unitValueInPln handles response without periods gracefully`() = runBlocking {
        val responseBody = """
            {
              "purchaseDate": "2024-03-15",
              "asOf": "2026-03-27",
              "firstPeriodRate": "6.50",
              "margin": "2.00",
              "principal": "100.00",
              "edoValue": {
                "totalValue": "106.50"
              }
            }
        """.trimIndent()

        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/edo/value") { exchange ->
            val bytes = responseBody.toByteArray()
            exchange.sendResponseHeaders(200, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()

        try {
            val client = EdoCalculatorClient(
                httpClient = HttpClient.newBuilder().build(),
                json = AppJsonFactory.create(),
                baseUrl = "http://127.0.0.1:${server.address.port}"
            )

            val result = client.unitValueInPln(
                EdoLotTerms(
                    purchaseDate = LocalDate.of(2024, 3, 15),
                    firstPeriodRateBps = 650,
                    marginBps = 200
                )
            )

            assertEquals(BigDecimal("106.50"), result.totalValue)
            assertNull(result.currentRatePercent)
        } finally {
            server.stop(0)
        }
    }
}
