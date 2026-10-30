package net.bobinski.portfolio.api.marketdata.service

import kotlin.coroutines.AbstractCoroutineContextElement
import kotlin.coroutines.CoroutineContext

/** Marks all market-data dependencies of a current valuation, including historical FX and previous close. */
object CurrentValuationContext : AbstractCoroutineContextElement(Key) {
    object Key : CoroutineContext.Key<CurrentValuationContext>
}
