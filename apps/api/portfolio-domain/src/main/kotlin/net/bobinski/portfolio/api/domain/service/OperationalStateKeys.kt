package net.bobinski.portfolio.api.domain.service

object OperationalStateKeys {
    const val MARKET_DATA_SNAPSHOT_PREFIX = "market-data.snapshot."
    const val MARKET_DATA_SNAPSHOT_METADATA_PREFIX = "market-data.snapshot-meta."
    const val PORTFOLIO_MARKET_DATA_PREFIX = "portfolio.market-data."
    const val ACTIVE_ALERTS = "portfolio.alerts.active"

    fun isLegacyPreference(key: String): Boolean =
        key == ACTIVE_ALERTS || LEGACY_OPERATIONAL_PREFIXES.any(key::startsWith)

    private val LEGACY_OPERATIONAL_PREFIXES = listOf(
        MARKET_DATA_SNAPSHOT_PREFIX,
        MARKET_DATA_SNAPSHOT_METADATA_PREFIX,
        PORTFOLIO_MARKET_DATA_PREFIX
    )
}
