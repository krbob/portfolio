package net.bobinski.portfolio.api.persistence.jdbc

import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import java.sql.Connection
import java.sql.Types
import java.util.UUID
import javax.sql.DataSource

class JdbcTransactionRepository(
    private val dataSource: DataSource
) : TransactionRepository {

    override suspend fun list(): List<Transaction> =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                select
                    id, account_id, instrument_id, type, trade_date, settlement_date,
                    quantity, unit_price, gross_amount, fee_amount, tax_amount, currency,
                    fx_rate_to_pln, notes, created_at, updated_at
                from transactions
                order by trade_date desc, created_at desc
                """.trimIndent()
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(resultSet.toTransaction())
                        }
                    }
                }
            }
        }

    override suspend fun get(id: UUID): Transaction? =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                select
                    id, account_id, instrument_id, type, trade_date, settlement_date,
                    quantity, unit_price, gross_amount, fee_amount, tax_amount, currency,
                    fx_rate_to_pln, notes, created_at, updated_at
                from transactions
                where id = ?
                """.trimIndent()
            ).use { statement ->
                statement.setObject(1, id)
                statement.executeQuery().use { resultSet ->
                    if (resultSet.next()) resultSet.toTransaction() else null
                }
            }
        }

    override suspend fun save(transaction: Transaction): Transaction {
        dataSource.connection.use { connection ->
            connection.insertTransaction(transaction)
        }
        return transaction
    }

    private fun Connection.insertTransaction(transaction: Transaction) {
        prepareStatement(
            """
            insert into transactions (
                id, account_id, instrument_id, type, trade_date, settlement_date, quantity, unit_price,
                gross_amount, fee_amount, tax_amount, currency, fx_rate_to_pln, notes, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent()
        ).use { statement ->
            statement.setObject(1, transaction.id)
            statement.setObject(2, transaction.accountId)
            if (transaction.instrumentId == null) {
                statement.setNull(3, Types.OTHER)
            } else {
                statement.setObject(3, transaction.instrumentId)
            }
            statement.setString(4, transaction.type.name)
            statement.setObject(5, transaction.tradeDate)
            if (transaction.settlementDate == null) {
                statement.setNull(6, Types.DATE)
            } else {
                statement.setObject(6, transaction.settlementDate)
            }
            if (transaction.quantity == null) {
                statement.setNull(7, Types.NUMERIC)
            } else {
                statement.setBigDecimal(7, transaction.quantity)
            }
            if (transaction.unitPrice == null) {
                statement.setNull(8, Types.NUMERIC)
            } else {
                statement.setBigDecimal(8, transaction.unitPrice)
            }
            statement.setBigDecimal(9, transaction.grossAmount)
            statement.setBigDecimal(10, transaction.feeAmount)
            statement.setBigDecimal(11, transaction.taxAmount)
            statement.setString(12, transaction.currency)
            if (transaction.fxRateToPln == null) {
                statement.setNull(13, Types.NUMERIC)
            } else {
                statement.setBigDecimal(13, transaction.fxRateToPln)
            }
            statement.setString(14, transaction.notes)
            statement.setTimestamp(15, transaction.createdAt.toSqlTimestamp())
            statement.setTimestamp(16, transaction.updatedAt.toSqlTimestamp())
            statement.executeUpdate()
        }
    }

    private fun java.sql.ResultSet.toTransaction(): Transaction = Transaction(
        id = getObject("id", UUID::class.java),
        accountId = getObject("account_id", UUID::class.java),
        instrumentId = getObject("instrument_id", UUID::class.java),
        type = TransactionType.valueOf(getString("type")),
        tradeDate = getObject("trade_date", java.time.LocalDate::class.java),
        settlementDate = getObject("settlement_date", java.time.LocalDate::class.java),
        quantity = getBigDecimal("quantity"),
        unitPrice = getBigDecimal("unit_price"),
        grossAmount = getBigDecimal("gross_amount"),
        feeAmount = getBigDecimal("fee_amount"),
        taxAmount = getBigDecimal("tax_amount"),
        currency = getString("currency"),
        fxRateToPln = getBigDecimal("fx_rate_to_pln"),
        notes = getString("notes"),
        createdAt = instant("created_at"),
        updatedAt = instant("updated_at")
    )
}
