package net.bobinski.portfolio.api.marketdata.service

import java.net.Authenticator
import java.net.CookieHandler
import java.net.ProxySelector
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import java.util.Optional
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executor
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLParameters
import kotlinx.coroutines.CancellationException

internal class SelectiveCancellingHttpClient(
    private val delegate: HttpClient = HttpClient.newHttpClient(),
    private val shouldCancel: (HttpRequest) -> Boolean
) : HttpClient() {
    override fun cookieHandler(): Optional<CookieHandler> = delegate.cookieHandler()
    override fun connectTimeout(): Optional<Duration> = delegate.connectTimeout()
    override fun followRedirects(): Redirect = delegate.followRedirects()
    override fun proxy(): Optional<ProxySelector> = delegate.proxy()
    override fun sslContext(): SSLContext = delegate.sslContext()
    override fun sslParameters(): SSLParameters = delegate.sslParameters()
    override fun authenticator(): Optional<Authenticator> = delegate.authenticator()
    override fun version(): Version = delegate.version()
    override fun executor(): Optional<Executor> = delegate.executor()

    override fun <T : Any?> send(
        request: HttpRequest,
        responseBodyHandler: HttpResponse.BodyHandler<T>
    ): HttpResponse<T> {
        if (shouldCancel(request)) throw CancellationException("Caller cancelled the upstream request.")
        return delegate.send(request, responseBodyHandler)
    }

    override fun <T : Any?> sendAsync(
        request: HttpRequest,
        responseBodyHandler: HttpResponse.BodyHandler<T>
    ): CompletableFuture<HttpResponse<T>> = if (shouldCancel(request)) {
        CompletableFuture.failedFuture(CancellationException("Caller cancelled the upstream request."))
    } else {
        delegate.sendAsync(request, responseBodyHandler)
    }

    override fun <T : Any?> sendAsync(
        request: HttpRequest,
        responseBodyHandler: HttpResponse.BodyHandler<T>,
        pushPromiseHandler: HttpResponse.PushPromiseHandler<T>
    ): CompletableFuture<HttpResponse<T>> = if (shouldCancel(request)) {
        CompletableFuture.failedFuture(CancellationException("Caller cancelled the upstream request."))
    } else {
        delegate.sendAsync(request, responseBodyHandler, pushPromiseHandler)
    }
}
