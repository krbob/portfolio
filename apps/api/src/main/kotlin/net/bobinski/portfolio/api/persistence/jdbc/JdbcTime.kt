package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.Timestamp
import java.sql.Types
import java.time.Instant
import java.time.LocalDate

internal fun ResultSet.instant(column: String): Instant = getTimestamp(column).toInstant()

internal fun ResultSet.instantOrNull(column: String): Instant? = getTimestamp(column)?.toInstant()

internal fun ResultSet.localDateOrNull(column: String): LocalDate? = getDate(column)?.toLocalDate()

internal fun Instant.toSqlTimestamp(): Timestamp = Timestamp.from(this)

internal fun PreparedStatement.setTimestampOrNull(index: Int, value: Instant?) {
    if (value == null) {
        setNull(index, Types.TIMESTAMP_WITH_TIMEZONE)
    } else {
        setTimestamp(index, value.toSqlTimestamp())
    }
}
