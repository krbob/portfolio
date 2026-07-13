package net.bobinski.portfolio.api.notification

import java.security.KeyPairGenerator
import java.security.Security
import java.security.spec.ECGenParameterSpec
import nl.martijndwars.webpush.Encoding
import nl.martijndwars.webpush.Notification
import nl.martijndwars.webpush.PushService
import org.bouncycastle.jce.provider.BouncyCastleProvider
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class WebPushDependencyCompatibilityTest {

    @Test
    fun `apache push service prepares encrypted request without async http client`() {
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(BouncyCastleProvider())
        }
        val keyGenerator = KeyPairGenerator.getInstance("EC", BouncyCastleProvider.PROVIDER_NAME).apply {
            initialize(ECGenParameterSpec("secp256r1"))
        }
        val pushService = PushService(keyGenerator.generateKeyPair(), "mailto:portfolio@example.test")
        val notification = Notification(
            "https://push.example.test/messages/1",
            keyGenerator.generateKeyPair().public,
            ByteArray(16) { index -> index.toByte() },
            "test payload".encodeToByteArray()
        )

        val request = pushService.preparePost(notification, Encoding.AESGCM)

        assertTrue(request.uri.toString().startsWith("https://push.example.test/"))
        assertNotNull(request.getFirstHeader("Authorization"))
        assertNotNull(request.entity)
    }
}
