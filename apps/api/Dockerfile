FROM gradle:9.6.1-jdk21 AS build

WORKDIR /workspace

COPY gradlew gradlew
COPY gradlew.bat gradlew.bat
COPY settings.gradle.kts settings.gradle.kts
COPY build.gradle.kts build.gradle.kts
COPY gradle gradle
COPY portfolio-domain portfolio-domain
COPY src src

RUN ./gradlew --no-daemon installDist

FROM eclipse-temurin:25.0.3_9-jre

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system portfolio \
    && useradd --system --gid portfolio --home-dir /app --no-create-home portfolio \
    && mkdir -p /srv/portfolio/data /srv/portfolio/backups \
    && chown -R portfolio:portfolio /srv/portfolio

COPY --from=build --chown=portfolio:portfolio /workspace/build/install/portfolio-api/ /app/

USER portfolio

EXPOSE 18082

ENTRYPOINT ["/app/bin/portfolio-api"]
