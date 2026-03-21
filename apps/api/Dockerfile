FROM gradle:9.4.1-jdk21 AS build

WORKDIR /workspace

COPY gradlew gradlew
COPY gradlew.bat gradlew.bat
COPY settings.gradle.kts settings.gradle.kts
COPY build.gradle.kts build.gradle.kts
COPY gradle gradle
COPY portfolio-domain portfolio-domain
COPY src src

RUN ./gradlew --no-daemon installDist

FROM eclipse-temurin:25.0.2_10-jre

WORKDIR /app

COPY --from=build /workspace/build/install/portfolio-api/ /app/

EXPOSE 18082

ENTRYPOINT ["/app/bin/portfolio-api"]
