package net.bobinski.portfolio.api.marketdata.client

class MarketDataClientException(
    message: String,
    val upstream: String? = null,
    val operation: String? = null,
    val symbol: String? = null,
    val statusCode: Int? = null,
    val responseBodyPreview: String? = null
) : RuntimeException(message)

internal fun responseBodyPreview(body: String?, maxLength: Int = 280): String? {
    val normalized = body
        ?.replace(Regex("\\s+"), " ")
        ?.trim()
        ?.takeIf { it.isNotEmpty() }
        ?: return null

    return if (normalized.length <= maxLength) {
        normalized
    } else {
        "${normalized.take(maxLength - 1)}…"
    }
}
