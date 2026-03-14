package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.Connection
import java.sql.ResultSet
import java.sql.Types
import javax.sql.DataSource
import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import java.util.UUID

class JdbcInstrumentRepository(
    private val dataSource: DataSource
) : InstrumentRepository {

    override suspend fun list(): List<Instrument> =
        dataSource.connection.use { connection ->
            connection.prepareStatement(BASE_SELECT + " order by i.created_at desc").use { statement ->
                statement.executeQuery().use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(resultSet.toInstrument())
                        }
                    }
                }
            }
        }

    override suspend fun get(id: UUID): Instrument? =
        dataSource.connection.use { connection ->
            connection.prepareStatement(BASE_SELECT + " where i.id = ?").use { statement ->
                statement.setUuid(1, id)
                statement.executeQuery().use { resultSet ->
                    if (resultSet.next()) resultSet.toInstrument() else null
                }
            }
        }

    override suspend fun save(instrument: Instrument): Instrument {
        dataSource.connection.use { connection ->
            val previousAutoCommit = connection.autoCommit
            connection.autoCommit = false
            try {
                connection.upsertInstrument(instrument)
                connection.deleteEdoTerms(instrument.id)
                instrument.edoTerms?.let { connection.upsertEdoTerms(instrument.id, it) }
                connection.commit()
            } catch (error: Exception) {
                connection.rollback()
                throw error
            } finally {
                connection.autoCommit = previousAutoCommit
            }
        }
        return instrument
    }

    override suspend fun deleteAll() {
        dataSource.connection.use { connection ->
            val previousAutoCommit = connection.autoCommit
            connection.autoCommit = false
            try {
                connection.prepareStatement("delete from edo_terms").use { it.executeUpdate() }
                connection.prepareStatement("delete from instruments").use { it.executeUpdate() }
                connection.commit()
            } catch (error: Exception) {
                connection.rollback()
                throw error
            } finally {
                connection.autoCommit = previousAutoCommit
            }
        }
    }

    private fun Connection.upsertInstrument(instrument: Instrument) {
        prepareStatement(
            """
            insert into instruments (
                id, name, kind, asset_class, symbol, currency, valuation_source, is_active, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict(id) do update set
                name = excluded.name,
                kind = excluded.kind,
                asset_class = excluded.asset_class,
                symbol = excluded.symbol,
                currency = excluded.currency,
                valuation_source = excluded.valuation_source,
                is_active = excluded.is_active,
                updated_at = excluded.updated_at
            """.trimIndent()
        ).use { statement ->
            statement.setUuid(1, instrument.id)
            statement.setString(2, instrument.name)
            statement.setString(3, instrument.kind.name)
            statement.setString(4, instrument.assetClass.name)
            if (instrument.symbol == null) {
                statement.setNull(5, Types.VARCHAR)
            } else {
                statement.setString(5, instrument.symbol)
            }
            statement.setString(6, instrument.currency)
            statement.setString(7, instrument.valuationSource.name)
            statement.setBooleanAsInteger(8, instrument.isActive)
            statement.setInstant(9, instrument.createdAt)
            statement.setInstant(10, instrument.updatedAt)
            statement.executeUpdate()
        }
    }

    private fun Connection.upsertEdoTerms(instrumentId: UUID, edoTerms: EdoTerms) {
        prepareStatement(
            """
            insert into edo_terms (
                instrument_id, purchase_date, first_period_rate_bps, margin_bps, principal_units, maturity_date
            ) values (?, ?, ?, ?, ?, ?)
            on conflict(instrument_id) do update set
                purchase_date = excluded.purchase_date,
                first_period_rate_bps = excluded.first_period_rate_bps,
                margin_bps = excluded.margin_bps,
                principal_units = excluded.principal_units,
                maturity_date = excluded.maturity_date
            """.trimIndent()
        ).use { statement ->
            statement.setUuid(1, instrumentId)
            statement.setLocalDate(2, edoTerms.purchaseDate)
            statement.setInt(3, edoTerms.firstPeriodRateBps)
            statement.setInt(4, edoTerms.marginBps)
            statement.setInt(5, edoTerms.principalUnits)
            statement.setLocalDate(6, edoTerms.maturityDate)
            statement.executeUpdate()
        }
    }

    private fun Connection.deleteEdoTerms(instrumentId: UUID) {
        prepareStatement("delete from edo_terms where instrument_id = ?").use { statement ->
            statement.setUuid(1, instrumentId)
            statement.executeUpdate()
        }
    }

    private fun ResultSet.toInstrument(): Instrument = Instrument(
        id = uuid("id"),
        name = getString("name"),
        kind = InstrumentKind.valueOf(getString("kind")),
        assetClass = AssetClass.valueOf(getString("asset_class")),
        symbol = getString("symbol"),
        currency = getString("currency"),
        valuationSource = ValuationSource.valueOf(getString("valuation_source")),
        edoTerms = if (getString("purchase_date") == null) {
            null
        } else {
            EdoTerms(
                purchaseDate = localDate("purchase_date"),
                firstPeriodRateBps = getInt("first_period_rate_bps"),
                marginBps = getInt("margin_bps"),
                principalUnits = getInt("principal_units"),
                maturityDate = localDate("maturity_date")
            )
        },
        isActive = booleanFromInteger("is_active"),
        createdAt = instant("created_at"),
        updatedAt = instant("updated_at")
    )

    private companion object {
        const val BASE_SELECT = """
            select
                i.id,
                i.name,
                i.kind,
                i.asset_class,
                i.symbol,
                i.currency,
                i.valuation_source,
                i.is_active,
                i.created_at,
                i.updated_at,
                e.purchase_date,
                e.first_period_rate_bps,
                e.margin_bps,
                e.principal_units,
                e.maturity_date
            from instruments i
            left join edo_terms e on e.instrument_id = i.id
        """
    }
}
