package net.bobinski.portfolio.api.persistence.jdbc

import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant

internal fun ResultSet.instant(column: String): Instant = getTimestamp(column).toInstant()

internal fun Instant.toSqlTimestamp(): Timestamp = Timestamp.from(this)
