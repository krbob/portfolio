package net.bobinski.source

import kotlinx.serialization.json.Json
import net.bobinski.data.HistoricalPrice

object Yfinance {

    fun get(symbol: String, period: Period): Collection<HistoricalPrice> {
        //TODO create a separate dockerized service for this
        ProcessBuilder("python3", "/bin/history.py", symbol, period.value).run {
            start()
        }.run {
            String(inputStream.readAllBytes())
        }.run {
            Json.decodeFromString<List<HistoricalPrice>>(this)
        }.let { return it }
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