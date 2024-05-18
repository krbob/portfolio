package net.bobinski

object Config {
    const val PORT = 7777
    val backendUrl = requireNotNull(System.getenv("BACKEND_URL"))
}