package net.bobinski.portfolio.api.domain.service

import java.math.BigDecimal
import java.util.UUID
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType

object TransactionLedger {
    val order: Comparator<Transaction> = compareBy(
        Transaction::tradeDate,
        Transaction::createdAt,
        Transaction::id
    )

    fun requireLongOnly(transactions: Collection<Transaction>) {
        val violation = firstLongOnlyViolation(transactions) ?: return
        throw IllegalArgumentException(violation.message)
    }

    fun firstLongOnlyViolation(transactions: Collection<Transaction>): LongOnlyLedgerViolation? {
        val quantities = mutableMapOf<InstrumentPositionKey, BigDecimal>()

        transactions.sortedWith(order).forEach { transaction ->
            val positionKey = transaction.positionKeyOrNull() ?: return@forEach
            val quantity = requireNotNull(transaction.quantity)
            val availableQuantity = quantities.getOrDefault(positionKey, BigDecimal.ZERO)

            when (transaction.type) {
                TransactionType.BUY -> quantities[positionKey] = availableQuantity.add(quantity)
                TransactionType.SELL,
                TransactionType.REDEEM -> {
                    if (quantity > availableQuantity) {
                        return LongOnlyLedgerViolation(
                            transaction = transaction,
                            availableQuantity = availableQuantity,
                            requestedQuantity = quantity
                        )
                    }
                    quantities[positionKey] = availableQuantity.subtract(quantity)
                }

                else -> Unit
            }
        }

        return null
    }

    private fun Transaction.positionKeyOrNull(): InstrumentPositionKey? = when (type) {
        TransactionType.BUY,
        TransactionType.SELL,
        TransactionType.REDEEM -> InstrumentPositionKey(
            accountId = accountId,
            instrumentId = requireNotNull(instrumentId)
        )

        else -> null
    }
}

data class LongOnlyLedgerViolation(
    val transaction: Transaction,
    val availableQuantity: BigDecimal,
    val requestedQuantity: BigDecimal
) {
    val message: String
        get() = buildString {
            append(transaction.type.name)
            append(" transaction on ")
            append(transaction.tradeDate)
            append(" exceeds the available quantity for instrument ")
            append(transaction.instrumentId)
            append(" in account ")
            append(transaction.accountId)
            append(": available ")
            append(availableQuantity.toPlainString())
            append(", requested ")
            append(requestedQuantity.toPlainString())
            append(". Long-only portfolios cannot have negative instrument positions.")
        }
}

private data class InstrumentPositionKey(
    val accountId: UUID,
    val instrumentId: UUID
)
