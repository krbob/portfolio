package net.bobinski.portfolio.api.config

import kotlinx.serialization.json.Json

object AppJsonFactory {
    fun create(): Json = Json {
        prettyPrint = true
        isLenient = false
        ignoreUnknownKeys = true
    }
}
