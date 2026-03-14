package net.bobinski.portfolio.api.persistence.jdbc

import java.math.BigDecimal
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Types
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.UUID

private val SQLITE_INSTANT_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSSSSSSSS'Z'")
        .withZone(ZoneOffset.UTC)

internal fun PreparedStatement.setUuid(index: Int, value: UUID) {
    setString(index, value.toString())
}

internal fun PreparedStatement.setUuidOrNull(index: Int, value: UUID?) {
    if (value == null) {
        setNull(index, Types.VARCHAR)
    } else {
        setUuid(index, value)
    }
}

internal fun PreparedStatement.setLocalDate(index: Int, value: LocalDate) {
    setString(index, value.toString())
}

internal fun PreparedStatement.setLocalDateOrNull(index: Int, value: LocalDate?) {
    if (value == null) {
        setNull(index, Types.VARCHAR)
    } else {
        setLocalDate(index, value)
    }
}

internal fun PreparedStatement.setInstant(index: Int, value: Instant) {
    setString(index, SQLITE_INSTANT_FORMATTER.format(value))
}

internal fun PreparedStatement.setInstantOrNull(index: Int, value: Instant?) {
    if (value == null) {
        setNull(index, Types.VARCHAR)
    } else {
        setInstant(index, value)
    }
}

internal fun PreparedStatement.setBigDecimal(index: Int, value: BigDecimal) {
    setString(index, value.toPlainString())
}

internal fun PreparedStatement.setBigDecimalOrNull(index: Int, value: BigDecimal?) {
    if (value == null) {
        setNull(index, Types.VARCHAR)
    } else {
        setBigDecimal(index, value)
    }
}

internal fun PreparedStatement.setBooleanAsInteger(index: Int, value: Boolean) {
    setInt(index, if (value) 1 else 0)
}

internal fun ResultSet.uuid(column: String): UUID = UUID.fromString(getString(column))

internal fun ResultSet.localDate(column: String): LocalDate = LocalDate.parse(getString(column))

internal fun ResultSet.localDateOrNull(column: String): LocalDate? = getString(column)?.let(LocalDate::parse)

internal fun ResultSet.instant(column: String): Instant = Instant.parse(getString(column))

internal fun ResultSet.instantOrNull(column: String): Instant? = getString(column)?.let(Instant::parse)

internal fun ResultSet.bigDecimal(column: String): BigDecimal = BigDecimal(getString(column))

internal fun ResultSet.bigDecimalOrNull(column: String): BigDecimal? = getString(column)?.let(::BigDecimal)

internal fun ResultSet.booleanFromInteger(column: String): Boolean = getInt(column) != 0
