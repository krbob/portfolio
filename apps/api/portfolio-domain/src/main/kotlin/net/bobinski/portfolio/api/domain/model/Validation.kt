package net.bobinski.portfolio.api.domain.model

internal fun isIsoCurrencyCode(currency: String): Boolean =
    currency.length == 3 && currency.all { it.isLetter() } && currency == currency.uppercase()
