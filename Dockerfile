FROM eclipse-temurin:17.0.13_11-jdk AS builder

WORKDIR /app

COPY gradle /app/gradle
COPY build.gradle.kts gradle.properties gradlew settings.gradle.kts /app/
COPY src /app/src

RUN --mount=type=cache,target=/root/.gradle \
    ./gradlew shadowJar --no-daemon

FROM eclipse-temurin:17.0.13_11-jre

WORKDIR /app

RUN useradd -m portfolio

USER portfolio

COPY --from=builder /app/build/libs/portfolio-all.jar portfolio.jar

EXPOSE 7777

CMD ["java", "-jar", "portfolio.jar"]