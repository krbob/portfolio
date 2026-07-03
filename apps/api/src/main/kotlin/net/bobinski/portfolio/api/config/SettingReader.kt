package net.bobinski.portfolio.api.config

import io.ktor.server.config.ApplicationConfig
import io.ktor.server.config.propertyOrNull
import java.nio.file.Path
import kotlin.io.path.readText

fun readSetting(
    envKey: String,
    config: ApplicationConfig,
    configKey: String,
    env: (String) -> String? = System::getenv
): String? =
    env(envKey)?.takeIf { it.isNotBlank() }
        ?: env("${envKey}_FILE")
            ?.takeIf { it.isNotBlank() }
            ?.let { Path.of(it).readText().trimEnd('\r', '\n') }
            ?.takeIf { it.isNotBlank() }
        ?: config.propertyOrNull(configKey)?.getString()
