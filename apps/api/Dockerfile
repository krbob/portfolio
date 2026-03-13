FROM gradle:9.1.0-jdk21 AS build

WORKDIR /workspace

COPY gradlew gradlew
COPY gradlew.bat gradlew.bat
COPY settings.gradle.kts settings.gradle.kts
COPY build.gradle.kts build.gradle.kts
COPY gradle gradle
COPY src src

RUN chmod +x gradlew && ./gradlew --no-daemon installDist

FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=build /workspace/build/install/portfolio-api/ /app/

EXPOSE 18082

ENTRYPOINT ["/app/bin/portfolio-api"]
