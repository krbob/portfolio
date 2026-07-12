import io.gitlab.arturbosch.detekt.Detekt
import io.gitlab.arturbosch.detekt.extensions.DetektExtension
import java.security.MessageDigest
import java.util.Properties

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ktor)
    alias(libs.plugins.detekt)
}

group = "net.bobinski.portfolio"
version = "0.1.0"

application {
    mainClass = "io.ktor.server.netty.EngineMain"
}

val contractGeneratorSourceSet = sourceSets.create("contractGenerator")
val upstreamContractsDirectory = layout.projectDirectory.dir("contracts/upstream")
val generatedContractsDirectory = layout.buildDirectory.dir("generated/sources/upstreamContracts/kotlin")
val generatedContractsFile = generatedContractsDirectory.map {
    it.file("net/bobinski/portfolio/api/marketdata/contract/generated/UpstreamContracts.kt")
}

dependencies {
    implementation(project(":portfolio-domain"))
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.netty)
    implementation(libs.ktor.server.call.logging)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.server.auth)
    implementation(libs.ktor.server.config.yaml)
    implementation(libs.ktor.server.openapi)
    implementation(libs.ktor.server.routing.openapi)
    implementation(libs.ktor.server.sessions)
    implementation(libs.ktor.server.status.pages)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.koin.ktor)
    implementation(libs.koin.logger.slf4j)
    implementation(libs.logback.classic)
    implementation(libs.hikaricp)
    implementation(libs.flyway.core)
    implementation(libs.sqlite.jdbc)
    implementation(libs.web.push)
    implementation(libs.bouncycastle.provider)
    implementation(libs.apache.httpcore)
    implementation(libs.apache.httpclient)
    implementation(libs.apache.httpasyncclient)

    testImplementation(platform(libs.junit.bom))
    testImplementation(libs.junit.jupiter)
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.swagger.parser)
    testRuntimeOnly(libs.junit.platform.launcher)

    add(contractGeneratorSourceSet.implementationConfigurationName, libs.swagger.parser)
}

val checkUpstreamContracts = tasks.register("checkUpstreamContracts") {
    group = "verification"
    description = "Verifies the hashes of vendored upstream OpenAPI snapshots."
    val lockFile = upstreamContractsDirectory.file("upstream-contracts.properties")
    inputs.file(lockFile)
    inputs.files(
        upstreamContractsDirectory.file("stock-analyst-v1.json"),
        upstreamContractsDirectory.file("edo-calculator-v1.yaml")
    )

    doLast {
        val properties = Properties().apply {
            lockFile.asFile.inputStream().use(::load)
        }
        check(properties.getProperty("generatorVersion") == "1") {
            "Unsupported upstream contract generator version in ${lockFile.asFile}."
        }
        listOf("stockAnalyst", "edoCalculator").forEach { contract ->
            val fileName = properties.getProperty("$contract.file")
                ?: error("Missing $contract.file in ${lockFile.asFile}")
            val expectedHash = properties.getProperty("$contract.sha256")
                ?: error("Missing $contract.sha256 in ${lockFile.asFile}")
            val snapshot = upstreamContractsDirectory.file(fileName).asFile
            val digest = MessageDigest.getInstance("SHA-256").digest(snapshot.readBytes())
            val actualHash = digest.joinToString("") { byte ->
                (byte.toInt() and 0xff).toString(16).padStart(2, '0')
            }
            check(actualHash == expectedHash) {
                "Hash mismatch for $fileName: expected $expectedHash, got $actualHash. " +
                    "Update the vendored snapshot and lock together."
            }
        }
    }
}

val generateUpstreamContracts = tasks.register<JavaExec>("generateUpstreamContracts") {
    group = "build"
    description = "Generates compact Kotlin response projections and paths from vendored OpenAPI snapshots."
    dependsOn(checkUpstreamContracts, contractGeneratorSourceSet.classesTaskName)
    classpath = contractGeneratorSourceSet.runtimeClasspath
    mainClass.set("net.bobinski.portfolio.contract.UpstreamContractGenerator")
    args(
        upstreamContractsDirectory.file("stock-analyst-v1.json").asFile.absolutePath,
        upstreamContractsDirectory.file("edo-calculator-v1.yaml").asFile.absolutePath,
        generatedContractsFile.get().asFile.absolutePath
    )
    inputs.files(
        upstreamContractsDirectory.file("stock-analyst-v1.json"),
        upstreamContractsDirectory.file("edo-calculator-v1.yaml")
    )
    inputs.files(contractGeneratorSourceSet.allSource)
    outputs.file(generatedContractsFile)
}

kotlin.sourceSets.named("main") {
    kotlin.srcDir(generatedContractsDirectory)
}

tasks.named("compileKotlin") {
    dependsOn(generateUpstreamContracts)
}

tasks.named("check") {
    dependsOn(checkUpstreamContracts)
}

configure<DetektExtension> {
    buildUponDefaultConfig = true
    parallel = true
    config.setFrom(rootProject.file("config/detekt/detekt.yml"))
    baseline = project.file("config/detekt/baseline.xml")
    basePath = rootDir.absolutePath
}

tasks.withType<Detekt>().configureEach {
    jvmTarget = "21"
    reports {
        html.required.set(true)
        sarif.required.set(true)
        txt.required.set(false)
        md.required.set(false)
    }
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
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

subprojects {
    apply(plugin = "io.gitlab.arturbosch.detekt")

    extensions.configure<DetektExtension> {
        buildUponDefaultConfig = true
        parallel = true
        config.setFrom(rootProject.file("config/detekt/detekt.yml"))
        baseline = project.file("config/detekt/baseline.xml")
        basePath = rootDir.absolutePath
    }

    tasks.withType<Detekt>().configureEach {
        jvmTarget = "21"
        reports {
            html.required.set(true)
            sarif.required.set(true)
            txt.required.set(false)
            md.required.set(false)
        }
    }
}
