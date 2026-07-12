package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class TransactionLedgerTest {
    @Test
    fun `selling an instrument that was never owned violates long-only ledger`() {
        val sell = transaction(type = TransactionType.SELL, quantity = "1")

        val error = assertThrows(IllegalArgumentException::class.java) {
            TransactionLedger.requireLongOnly(listOf(sell))
        }

        assertTrue(error.message.orEmpty().contains("available 0, requested 1"))
    }

    @Test
    fun `a backdated sale is validated against all later transactions`() {
        val buy = transaction(
            id = "00000000-0000-0000-0000-000000000001",
            type = TransactionType.BUY,
            tradeDate = "2026-03-01",
            quantity = "10"
        )
        val existingSale = transaction(
            id = "00000000-0000-0000-0000-000000000003",
            type = TransactionType.SELL,
            tradeDate = "2026-03-03",
            quantity = "10"
        )
        val backdatedSale = transaction(
            id = "00000000-0000-0000-0000-000000000002",
            type = TransactionType.SELL,
            tradeDate = "2026-03-02",
            quantity = "1"
        )

        val violation = TransactionLedger.firstLongOnlyViolation(
            listOf(existingSale, backdatedSale, buy)
        )

        assertEquals(existingSale.id, violation?.transaction?.id)
        assertEquals(BigDecimal("9"), violation?.availableQuantity)
        assertEquals(BigDecimal("10"), violation?.requestedQuantity)
    }

    @Test
    fun `same-day ordering is deterministic when creation timestamps match`() {
        val buy = transaction(
            id = "00000000-0000-0000-0000-000000000001",
            type = TransactionType.BUY,
            quantity = "2"
        )
        val sell = transaction(
            id = "00000000-0000-0000-0000-000000000002",
            type = TransactionType.SELL,
            quantity = "2"
        )

        assertNull(TransactionLedger.firstLongOnlyViolation(listOf(sell, buy)))
        assertEquals(listOf(buy.id, sell.id), listOf(sell, buy).sortedWith(TransactionLedger.order).map(Transaction::id))
    }

    private fun transaction(
        id: String = "00000000-0000-0000-0000-000000000001",
        type: TransactionType,
        tradeDate: String = "2026-03-01",
        quantity: String
    ): Transaction = Transaction(
        id = UUID.fromString(id),
        accountId = ACCOUNT_ID,
        instrumentId = INSTRUMENT_ID,
        type = type,
        tradeDate = LocalDate.parse(tradeDate),
        settlementDate = LocalDate.parse(tradeDate),
        quantity = BigDecimal(quantity),
        unitPrice = BigDecimal("100"),
        grossAmount = BigDecimal("100"),
        feeAmount = BigDecimal.ZERO,
        taxAmount = BigDecimal.ZERO,
        currency = "PLN",
        fxRateToPln = null,
        notes = "",
        createdAt = CREATED_AT,
        updatedAt = CREATED_AT
    )

    private companion object {
        val ACCOUNT_ID: UUID = UUID.fromString("11111111-1111-1111-1111-111111111111")
        val INSTRUMENT_ID: UUID = UUID.fromString("22222222-2222-2222-2222-222222222222")
        val CREATED_AT: Instant = Instant.parse("2026-03-20T12:00:00Z")
    }
}
