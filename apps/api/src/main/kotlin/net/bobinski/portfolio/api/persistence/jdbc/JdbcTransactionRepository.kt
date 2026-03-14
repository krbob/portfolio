package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.Connection
import javax.sql.DataSource
import net.bobinski.portfolio.api.domain.model.Transaction
import net.bobinski.portfolio.api.domain.model.TransactionType
import net.bobinski.portfolio.api.domain.repository.TransactionRepository
import java.util.UUID

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
                statement.setUuid(1, id)
                statement.executeQuery().use { resultSet ->
                    if (resultSet.next()) resultSet.toTransaction() else null
                }
            }
        }

    override suspend fun save(transaction: Transaction): Transaction {
        dataSource.connection.use { connection ->
            connection.upsertTransaction(transaction)
        }
        return transaction
    }

    override suspend fun delete(id: UUID): Boolean =
        dataSource.connection.use { connection ->
            connection.prepareStatement(
                """
                delete from transactions
                where id = ?
                """.trimIndent()
            ).use { statement ->
                statement.setUuid(1, id)
                statement.executeUpdate() > 0
            }
        }

    override suspend fun deleteAll() {
        dataSource.connection.use { connection ->
            connection.prepareStatement("delete from transactions").use { statement ->
                statement.executeUpdate()
            }
        }
    }

    private fun Connection.upsertTransaction(transaction: Transaction) {
        prepareStatement(
            """
            insert into transactions (
                id, account_id, instrument_id, type, trade_date, settlement_date, quantity, unit_price,
                gross_amount, fee_amount, tax_amount, currency, fx_rate_to_pln, notes, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
                account_id = excluded.account_id,
                instrument_id = excluded.instrument_id,
                type = excluded.type,
                trade_date = excluded.trade_date,
                settlement_date = excluded.settlement_date,
                quantity = excluded.quantity,
                unit_price = excluded.unit_price,
                gross_amount = excluded.gross_amount,
                fee_amount = excluded.fee_amount,
                tax_amount = excluded.tax_amount,
                currency = excluded.currency,
                fx_rate_to_pln = excluded.fx_rate_to_pln,
                notes = excluded.notes,
                updated_at = excluded.updated_at
            """.trimIndent()
        ).use { statement ->
            statement.setUuid(1, transaction.id)
            statement.setUuid(2, transaction.accountId)
            statement.setUuidOrNull(3, transaction.instrumentId)
            statement.setString(4, transaction.type.name)
            statement.setLocalDate(5, transaction.tradeDate)
            statement.setLocalDateOrNull(6, transaction.settlementDate)
            statement.setBigDecimalOrNull(7, transaction.quantity)
            statement.setBigDecimalOrNull(8, transaction.unitPrice)
            statement.setBigDecimal(9, transaction.grossAmount)
            statement.setBigDecimal(10, transaction.feeAmount)
            statement.setBigDecimal(11, transaction.taxAmount)
            statement.setString(12, transaction.currency)
            statement.setBigDecimalOrNull(13, transaction.fxRateToPln)
            statement.setString(14, transaction.notes)
            statement.setInstant(15, transaction.createdAt)
            statement.setInstant(16, transaction.updatedAt)
            statement.executeUpdate()
        }
    }

    private fun java.sql.ResultSet.toTransaction(): Transaction = Transaction(
        id = uuid("id"),
        accountId = uuid("account_id"),
        instrumentId = getString("instrument_id")?.let(UUID::fromString),
        type = TransactionType.valueOf(getString("type")),
        tradeDate = localDate("trade_date"),
        settlementDate = localDateOrNull("settlement_date"),
        quantity = bigDecimalOrNull("quantity"),
        unitPrice = bigDecimalOrNull("unit_price"),
        grossAmount = bigDecimal("gross_amount"),
        feeAmount = bigDecimal("fee_amount"),
        taxAmount = bigDecimal("tax_amount"),
        currency = getString("currency"),
        fxRateToPln = bigDecimalOrNull("fx_rate_to_pln"),
        notes = getString("notes"),
        createdAt = instant("created_at"),
        updatedAt = instant("updated_at")
    )
}
