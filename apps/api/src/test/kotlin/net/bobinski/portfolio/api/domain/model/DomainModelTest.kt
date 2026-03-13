package net.bobinski.portfolio.api.domain.model

import org.junit.jupiter.api.Assertions.assertDoesNotThrow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class DomainModelTest {

    @Test
    fun `EDO instrument requires EDO terms`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            Instrument(
                id = UUID.randomUUID(),
                name = "EDO 2035",
                kind = InstrumentKind.BOND_EDO,
                assetClass = AssetClass.BONDS,
                symbol = null,
                currency = "PLN",
                valuationSource = ValuationSource.EDO_CALCULATOR,
                edoTerms = null,
                isActive = true,
                createdAt = NOW,
                updatedAt = NOW
            )
        }

        assertEquals("EDO instruments require dedicated terms.", exception.message)
    }

    @Test
    fun `EDO instrument can be modeled as purchase-specific instrument`() {
        assertDoesNotThrow {
            Instrument(
                id = UUID.randomUUID(),
                name = "EDO 2035 2025-07-15",
                kind = InstrumentKind.BOND_EDO,
                assetClass = AssetClass.BONDS,
                symbol = null,
                currency = "PLN",
                valuationSource = ValuationSource.EDO_CALCULATOR,
                edoTerms = EdoTerms(
                    purchaseDate = LocalDate.parse("2025-07-15"),
                    firstPeriodRateBps = 650,
                    marginBps = 200,
                    principalUnits = 12,
                    maturityDate = LocalDate.parse("2035-07-15")
                ),
                isActive = true,
                createdAt = NOW,
                updatedAt = NOW
            )
        }
    }

    @Test
    fun `deposit transaction does not accept quantity`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            Transaction(
                id = UUID.randomUUID(),
                accountId = UUID.randomUUID(),
                instrumentId = null,
                type = TransactionType.DEPOSIT,
                tradeDate = LocalDate.parse("2026-01-10"),
                settlementDate = LocalDate.parse("2026-01-10"),
                quantity = BigDecimal.ONE,
                unitPrice = null,
                grossAmount = BigDecimal("1000.00"),
                feeAmount = BigDecimal.ZERO,
                taxAmount = BigDecimal.ZERO,
                currency = "PLN",
                fxRateToPln = null,
                notes = "",
                createdAt = NOW,
                updatedAt = NOW
            )
        }

        assertEquals("DEPOSIT transactions must not carry quantity.", exception.message)
    }

    @Test
    fun `buy transaction requires quantity and unit price`() {
        val exception = assertThrows(IllegalArgumentException::class.java) {
            Transaction(
                id = UUID.randomUUID(),
                accountId = UUID.randomUUID(),
                instrumentId = UUID.randomUUID(),
                type = TransactionType.BUY,
                tradeDate = LocalDate.parse("2026-01-10"),
                settlementDate = LocalDate.parse("2026-01-12"),
                quantity = BigDecimal.ZERO,
                unitPrice = BigDecimal("123.45"),
                grossAmount = BigDecimal("1234.50"),
                feeAmount = BigDecimal("4.99"),
                taxAmount = BigDecimal.ZERO,
                currency = "USD",
                fxRateToPln = BigDecimal("4.0123"),
                notes = "",
                createdAt = NOW,
                updatedAt = NOW
            )
        }

        assertEquals("BUY transactions require positive quantity.", exception.message)
    }

    private companion object {
        val NOW: Instant = Instant.parse("2026-03-13T12:00:00Z")
    }
}
