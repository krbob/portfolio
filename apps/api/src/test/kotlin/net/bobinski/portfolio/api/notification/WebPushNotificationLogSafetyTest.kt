package net.bobinski.portfolio.api.notification

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class WebPushNotificationLogSafetyTest {
    @Test
    fun `subscription log id is stable and does not expose endpoint details`() {
        val endpoint = "https://push.example.test/private/subscription-token?auth=secret"

        val first = webPushSubscriptionId(endpoint)
        val second = webPushSubscriptionId(endpoint)

        assertEquals(first, second)
        assertEquals(12, first.length)
        assertTrue(first.matches(Regex("[A-Za-z0-9_-]+")))
        assertFalse(endpoint.contains(first))
        assertFalse(first.contains("push", ignoreCase = true))
        assertFalse(first.contains("secret", ignoreCase = true))
        assertNotEquals(first, webPushSubscriptionId("$endpoint-2"))
    }
}
