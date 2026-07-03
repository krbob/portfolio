package net.bobinski.portfolio.api.notification.config

import io.ktor.server.config.ApplicationConfig
import java.math.BigDecimal
import net.bobinski.portfolio.api.config.readSetting

data class PortfolioAlertConfig(
    val enabled: Boolean,
    val allocationDriftThresholdPctPoints: BigDecimal,
    val benchmarkUnderperformanceThresholdPctPoints: BigDecimal,
    val webPushVapidPublicKey: String?,
    val webPushVapidPrivateKey: String?,
    val webPushVapidSubject: String?
) {
    val webPushEnabled: Boolean
        get() = !webPushVapidPublicKey.isNullOrBlank() &&
            !webPushVapidPrivateKey.isNullOrBlank() &&
            !webPushVapidSubject.isNullOrBlank()

    companion object {
        fun from(config: ApplicationConfig, env: (String) -> String? = System::getenv): PortfolioAlertConfig =
            PortfolioAlertConfig(
                enabled = readSetting("PORTFOLIO_ALERTS_ENABLED", config, "portfolio.alerts.enabled", env)
                    ?.toBooleanStrictOrNull()
                    ?: true,
                allocationDriftThresholdPctPoints = readSetting(
                    "PORTFOLIO_ALERT_ALLOCATION_DRIFT_THRESHOLD_PCT_POINTS",
                    config,
                    "portfolio.alerts.allocationDriftThresholdPctPoints",
                    env
                )?.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO } ?: BigDecimal("5.00"),
                benchmarkUnderperformanceThresholdPctPoints = readSetting(
                    "PORTFOLIO_ALERT_BENCHMARK_UNDERPERFORMANCE_THRESHOLD_PCT_POINTS",
                    config,
                    "portfolio.alerts.benchmarkUnderperformanceThresholdPctPoints",
                    env
                )?.toBigDecimalOrNull()?.takeIf { it > BigDecimal.ZERO } ?: BigDecimal("5.00"),
                webPushVapidPublicKey = readSetting(
                    "PORTFOLIO_WEB_PUSH_VAPID_PUBLIC_KEY",
                    config,
                    "portfolio.alerts.webPush.vapidPublicKey",
                    env
                ),
                webPushVapidPrivateKey = readSetting(
                    "PORTFOLIO_WEB_PUSH_VAPID_PRIVATE_KEY_B64",
                    config,
                    "portfolio.alerts.webPush.vapidPrivateKeyB64",
                    env
                ) ?: readSetting(
                    "PORTFOLIO_WEB_PUSH_VAPID_PRIVATE_KEY",
                    config,
                    "portfolio.alerts.webPush.vapidPrivateKey",
                    env
                ),
                webPushVapidSubject = readSetting(
                    "PORTFOLIO_WEB_PUSH_VAPID_SUBJECT",
                    config,
                    "portfolio.alerts.webPush.vapidSubject",
                    env
                )
            )
    }
}
