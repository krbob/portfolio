package net.bobinski.portfolio.api

import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.URI

class ApiHealthProbeTest {
    @Test
    fun `probe accepts a healthy endpoint`() {
        withEndpoint(status = 200) { endpoint ->
            assertTrue(ApiHealthProbe.isHealthy(endpoint, 1_000))
        }
    }

    @Test
    fun `probe rejects a degraded endpoint`() {
        withEndpoint(status = 503) { endpoint ->
            assertFalse(ApiHealthProbe.isHealthy(endpoint, 1_000))
        }
    }

    private fun withEndpoint(status: Int, assertion: (URI) -> Unit) {
        val server = HttpServer.create(InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0)
        server.createContext("/v1/health") { exchange ->
            exchange.sendResponseHeaders(status, -1)
            exchange.close()
        }
        server.start()
        try {
            assertion(URI.create("http://127.0.0.1:${server.address.port}/v1/health"))
        } finally {
            server.stop(0)
        }
    }
}
