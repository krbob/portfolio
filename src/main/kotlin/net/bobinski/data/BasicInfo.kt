package net.bobinski.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class BasicInfo(
    val name: String?,
    @SerialName("pe_ratio")
    val peRatio: Float?,
    @SerialName("pb_ratio")
    val pbRatio: Float?,
    val eps: Float?,
    val roe: Float?,
    @SerialName("market_cap")
    val marketCap: Float?
)