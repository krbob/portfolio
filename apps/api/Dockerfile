FROM gradle:9.6.1-jdk21 AS build

WORKDIR /workspace

COPY gradlew gradlew
COPY gradlew.bat gradlew.bat
COPY settings.gradle.kts settings.gradle.kts
COPY build.gradle.kts build.gradle.kts
COPY gradle gradle
COPY portfolio-domain portfolio-domain
COPY contracts contracts
COPY src src

RUN ./gradlew --no-daemon installDist

FROM eclipse-temurin:25.0.3_9-jre

WORKDIR /app

ARG PORTFOLIO_UID=10001
ARG PORTFOLIO_GID=10001

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid "${PORTFOLIO_GID}" portfolio \
    && useradd --uid "${PORTFOLIO_UID}" --gid portfolio --home-dir /app --no-create-home --shell /usr/sbin/nologin portfolio \
    && mkdir -p /srv/portfolio/data /srv/portfolio/backups \
    && chown -R portfolio:portfolio /app /srv/portfolio

COPY --from=build --chown=${PORTFOLIO_UID}:${PORTFOLIO_GID} /workspace/build/install/portfolio-api/ /app/

USER ${PORTFOLIO_UID}:${PORTFOLIO_GID}

EXPOSE 18082

ENTRYPOINT ["/app/bin/portfolio-api"]
