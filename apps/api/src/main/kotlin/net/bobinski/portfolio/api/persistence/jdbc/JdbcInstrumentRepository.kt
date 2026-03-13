package net.bobinski.portfolio.api.persistence.jdbc

import net.bobinski.portfolio.api.domain.model.AssetClass
import net.bobinski.portfolio.api.domain.model.EdoTerms
import net.bobinski.portfolio.api.domain.model.Instrument
import net.bobinski.portfolio.api.domain.model.InstrumentKind
import net.bobinski.portfolio.api.domain.model.ValuationSource
import net.bobinski.portfolio.api.domain.repository.InstrumentRepository
import java.sql.Connection
import java.sql.ResultSet
import java.sql.Types
import java.util.UUID
import javax.sql.DataSource

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
                statement.setObject(1, id)
                statement.executeQuery().use { resultSet ->
                    if (resultSet.next()) resultSet.toInstrument() else null
                }
            }
        }

    override suspend fun save(instrument: Instrument): Instrument {
        dataSource.connection.use { connection ->
            connection.autoCommit = false
            try {
                connection.insertInstrument(instrument)
                instrument.edoTerms?.let { connection.insertEdoTerms(instrument.id, it) }
                connection.commit()
            } catch (exception: Exception) {
                connection.rollback()
                throw exception
            } finally {
                connection.autoCommit = true
            }
        }
        return instrument
    }

    private fun Connection.insertInstrument(instrument: Instrument) {
        prepareStatement(
            """
            insert into instruments (
                id, name, kind, asset_class, symbol, currency, valuation_source, is_active, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """.trimIndent()
        ).use { statement ->
            statement.setObject(1, instrument.id)
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
            statement.setBoolean(8, instrument.isActive)
            statement.setTimestamp(9, instrument.createdAt.toSqlTimestamp())
            statement.setTimestamp(10, instrument.updatedAt.toSqlTimestamp())
            statement.executeUpdate()
        }
    }

    private fun Connection.insertEdoTerms(instrumentId: UUID, edoTerms: EdoTerms) {
        prepareStatement(
            """
            insert into edo_terms (
                instrument_id, purchase_date, first_period_rate_bps, margin_bps, principal_units, maturity_date
            ) values (?, ?, ?, ?, ?, ?)
            """.trimIndent()
        ).use { statement ->
            statement.setObject(1, instrumentId)
            statement.setObject(2, edoTerms.purchaseDate)
            statement.setInt(3, edoTerms.firstPeriodRateBps)
            statement.setInt(4, edoTerms.marginBps)
            statement.setInt(5, edoTerms.principalUnits)
            statement.setObject(6, edoTerms.maturityDate)
            statement.executeUpdate()
        }
    }

    private fun ResultSet.toInstrument(): Instrument = Instrument(
        id = getObject("id", UUID::class.java),
        name = getString("name"),
        kind = InstrumentKind.valueOf(getString("kind")),
        assetClass = AssetClass.valueOf(getString("asset_class")),
        symbol = getString("symbol"),
        currency = getString("currency"),
        valuationSource = ValuationSource.valueOf(getString("valuation_source")),
        edoTerms = if (getObject("purchase_date") == null) {
            null
        } else {
            EdoTerms(
                purchaseDate = getObject("purchase_date", java.time.LocalDate::class.java),
                firstPeriodRateBps = getInt("first_period_rate_bps"),
                marginBps = getInt("margin_bps"),
                principalUnits = getInt("principal_units"),
                maturityDate = getObject("maturity_date", java.time.LocalDate::class.java)
            )
        },
        isActive = getBoolean("is_active"),
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
