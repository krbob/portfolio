package net.bobinski.portfolio.api.notification

import java.time.Instant
import net.bobinski.portfolio.api.domain.model.AssetClass
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class WebPushNotificationLocalizationTest {
    @Test
    fun `push payload is rendered independently for each subscription locale`() {
        val timestamp = Instant.parse("2026-07-13T10:15:00Z")
        val alerts = listOf(
            allocationAlert("allocation:CASH", AssetClass.CASH),
            allocationAlert("allocation:EQUITIES", AssetClass.EQUITIES)
        )

        val polish = alerts.toPushPayload(PortfolioLocale.PL, timestamp)
        val english = alerts.toPushPayload(PortfolioLocale.EN, timestamp)

        assertEquals("Portfolio: 2 nowe alerty", polish.title)
        assertEquals("Dryf alokacji: gotówka, Dryf alokacji: akcje", polish.body)
        assertEquals("Portfolio: 2 new alerts", english.title)
        assertEquals("Allocation drift: cash, Allocation drift: equities", english.body)
        assertEquals(timestamp.toString(), polish.timestamp)
        assertEquals(timestamp.toString(), english.timestamp)
    }

    private fun allocationAlert(id: String, assetClass: AssetClass) = PortfolioAlert(
        id = id,
        type = PortfolioAlertType.ALLOCATION_DRIFT,
        severity = PortfolioAlertSeverity.WARNING,
        content = PortfolioAlertContent.AllocationDrift(
            assetClass = assetClass,
            driftPctPoints = "10.00",
            thresholdPctPoints = "5.00"
        ),
        route = "/strategy/targets",
        observedAt = Instant.parse("2026-07-13T10:10:00Z")
    )
}
