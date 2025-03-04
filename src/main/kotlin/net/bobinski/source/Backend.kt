package net.bobinski.source

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.cache.HttpCache
import io.ktor.client.plugins.cache.storage.FileStorage
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.get
import io.ktor.http.isSuccess
import io.ktor.serialization.kotlinx.json.json
import net.bobinski.Config
import net.bobinski.data.BasicInfo
import net.bobinski.data.HistoricalPrice
import java.nio.file.Files
import java.nio.file.Paths

object Backend {

    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json()
        }
        install(HttpCache) {
            val cacheFile = Files.createDirectories(Paths.get("/tmp/cache")).toFile()
            publicStorage(FileStorage(cacheFile))
        }
    }

    suspend fun getHistory(symbol: String, period: Period): Collection<HistoricalPrice> {
        return client
            .get("${Config.backendUrl}/history/$symbol/${period.value}")
            .run { if (status.isSuccess()) body() else emptySet() }
    }

    suspend fun getInfo(symbol: String): BasicInfo? {
        return client
            .get("${Config.backendUrl}/info/$symbol")
            .run { if (status.isSuccess()) body() else null }
    }

    enum class Period(val value: String) {
        _1d("1d"),
        _5d("5d"),
        _1mo("1mo"),
        _3mo("3mo"),
        _6mo("6mo"),
        _1y("1y"),
        _2y("2y"),
        _5y("5y"),
        _10y("10y"),
        ytd("ytd"),
        max("max")
    }
}