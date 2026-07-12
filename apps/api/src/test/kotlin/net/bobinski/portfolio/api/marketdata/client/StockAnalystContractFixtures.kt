package net.bobinski.portfolio.api.marketdata.client

internal fun String.withStockAnalystProvenance(): String {
    val payload = trim()
    require(payload.endsWith('}')) { "Stock Analyst fixture must be a JSON object." }
    return payload.dropLast(1) + ",\"provenance\":$PROVENANCE_JSON}"
}

private const val PROVENANCE_JSON =
    """{"source":"YAHOO_FINANCE","retrievedAt":"2026-03-20T20:00:00Z","unitScale":1.0,"adjustment":"RAW","status":"FRESH"}"""
