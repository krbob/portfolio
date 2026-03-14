plugins {
    kotlin("jvm") version "2.3.10"
    kotlin("plugin.serialization") version "2.3.10"
    id("io.ktor.plugin") version "3.4.1"
}

group = "net.bobinski.portfolio"
version = "0.1.0"

application {
    mainClass = "io.ktor.server.netty.EngineMain"
}

repositories {
    mavenCentral()
}

dependencies {
    implementation(project(":portfolio-domain"))
    implementation("io.ktor:ktor-server-core:3.4.1")
    implementation("io.ktor:ktor-server-netty:3.4.1")
    implementation("io.ktor:ktor-server-call-logging:3.4.1")
    implementation("io.ktor:ktor-server-content-negotiation:3.4.1")
    implementation("io.ktor:ktor-server-auth:3.4.1")
    implementation("io.ktor:ktor-server-config-yaml:3.4.1")
    implementation("io.ktor:ktor-server-openapi:3.4.1")
    implementation("io.ktor:ktor-server-routing-openapi:3.4.1")
    implementation("io.ktor:ktor-server-sessions:3.4.1")
    implementation("io.ktor:ktor-server-status-pages:3.4.1")
    implementation("io.ktor:ktor-serialization-kotlinx-json:3.4.1")
    implementation("io.insert-koin:koin-ktor:4.1.1")
    implementation("io.insert-koin:koin-logger-slf4j:4.1.1")
    implementation("ch.qos.logback:logback-classic:1.5.32")
    implementation("com.zaxxer:HikariCP:6.3.0")
    implementation("org.flywaydb:flyway-core:11.13.2")
    implementation("org.xerial:sqlite-jdbc:3.51.1.0")

    testImplementation(platform("org.junit:junit-bom:6.0.3"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testImplementation("io.ktor:ktor-server-test-host:3.4.1")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    environment("PORTFOLIO_PERSISTENCE_MODE", "memory")
}

tasks.register<Test>("exportOpenApiSpec") {
    val testSourceSet = sourceSets.named("test").get()
    testClassesDirs = testSourceSet.output.classesDirs
    classpath = testSourceSet.runtimeClasspath
    systemProperty(
        "portfolio.openapi.outputPath",
        layout.buildDirectory.file("openapi/portfolio-api.json").get().asFile.absolutePath
    )
    filter {
        includeTestsMatching("net.bobinski.portfolio.api.OpenApiExportTest")
    }
}

ktor {
    openApi {
        enabled = true
        codeInferenceEnabled = true
        onlyCommented = false
    }
}

kotlin {
    jvmToolchain(21)
}
