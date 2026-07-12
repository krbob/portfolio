package net.bobinski.portfolio.api.marketdata.service

import net.bobinski.portfolio.api.domain.service.OperationalStateKeys

object MarketDataSnapshotPreferences {
    const val PAYLOAD_KEY_PREFIX = OperationalStateKeys.MARKET_DATA_SNAPSHOT_PREFIX
    const val METADATA_KEY_PREFIX = OperationalStateKeys.MARKET_DATA_SNAPSHOT_METADATA_PREFIX
}
