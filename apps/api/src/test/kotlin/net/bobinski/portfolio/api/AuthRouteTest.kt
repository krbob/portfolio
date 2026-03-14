package net.bobinski.portfolio.api

import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.config.MapApplicationConfig
import io.ktor.server.testing.testApplication
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class AuthRouteTest {

    @Test
    fun `protected routes require login when password auth is enabled`() = testApplication {
        environment {
            config = MapApplicationConfig(
                "portfolio.auth.enabled" to "true",
                "portfolio.auth.password" to "secret-pass",
                "portfolio.auth.sessionSecret" to "0123456789abcdef0123456789abcdef",
                "portfolio.auth.sessionCookieName" to "portfolio_test_session",
                "portfolio.auth.secureCookie" to "false",
                "portfolio.auth.sessionMaxAgeDays" to "30"
            )
        }

        application {
            module()
        }

        val sessionStateResponse = client.get("/v1/auth/session")
        val unauthorizedAccountsResponse = client.get("/v1/accounts")
        val invalidLoginResponse = client.post("/v1/auth/session") {
            contentType(ContentType.Application.Json)
            setBody("""{"password":"wrong-pass"}""")
        }
        val validLoginResponse = client.post("/v1/auth/session") {
            contentType(ContentType.Application.Json)
            setBody("""{"password":"secret-pass"}""")
        }
        val sessionCookie = validLoginResponse.headers[HttpHeaders.SetCookie]
            ?.substringBefore(';')
            ?: error("Expected auth session cookie in login response.")
        val authorizedAccountsResponse = client.get("/v1/accounts") {
            header(HttpHeaders.Cookie, sessionCookie)
        }
        val logoutResponse = client.delete("/v1/auth/session") {
            header(HttpHeaders.Cookie, sessionCookie)
        }
        val unauthorizedAfterLogoutResponse = client.get("/v1/accounts")

        assertEquals(HttpStatusCode.OK, sessionStateResponse.status)
        assertTrue(sessionStateResponse.bodyAsText().contains("\"authEnabled\": true"))
        assertTrue(sessionStateResponse.bodyAsText().contains("\"authenticated\": false"))

        assertEquals(HttpStatusCode.Unauthorized, unauthorizedAccountsResponse.status)
        assertTrue(unauthorizedAccountsResponse.bodyAsText().contains("Authentication required."))

        assertEquals(HttpStatusCode.Unauthorized, invalidLoginResponse.status)
        assertTrue(invalidLoginResponse.bodyAsText().contains("Invalid password."))

        assertEquals(HttpStatusCode.OK, validLoginResponse.status)
        assertTrue(validLoginResponse.bodyAsText().contains("\"authenticated\": true"))

        assertEquals(HttpStatusCode.OK, authorizedAccountsResponse.status)
        assertEquals("[]", authorizedAccountsResponse.bodyAsText())

        assertEquals(HttpStatusCode.OK, logoutResponse.status)
        assertTrue(logoutResponse.bodyAsText().contains("\"authenticated\": false"))

        assertEquals(HttpStatusCode.Unauthorized, unauthorizedAfterLogoutResponse.status)
    }

    @Test
    fun `meta remains public when password auth is enabled`() = testApplication {
        environment {
            config = MapApplicationConfig(
                "portfolio.auth.enabled" to "true",
                "portfolio.auth.password" to "secret-pass",
                "portfolio.auth.sessionSecret" to "0123456789abcdef0123456789abcdef"
            )
        }

        application {
            module()
        }

        val metaResponse = client.get("/v1/meta")

        assertEquals(HttpStatusCode.OK, metaResponse.status)
        assertTrue(metaResponse.bodyAsText().contains("\"enabled\": true"))
        assertTrue(metaResponse.bodyAsText().contains("\"mode\": \"PASSWORD\""))
    }
}
