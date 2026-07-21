FROM gradle:9.6.1-jdk21@sha256:210bbd2656b56a7191a2e9e9f55e193f7a355f0c5565ac83984a5d1779dcdb74 AS build

WORKDIR /workspace

COPY settings.gradle.kts settings.gradle.kts
COPY settings-gradle.lockfile settings-gradle.lockfile
COPY build.gradle.kts build.gradle.kts
COPY gradle.lockfile gradle.lockfile
COPY gradle gradle
COPY portfolio-domain portfolio-domain
COPY contracts contracts
COPY src src

RUN --mount=type=cache,target=/home/gradle/.gradle,uid=1000,gid=1000 \
    gradle --no-daemon installDist

FROM eclipse-temurin:25.0.3_9-jre-noble@sha256:2f1da100788559b397bcf48c736169ea5b070bde84e55f203bbee8e83d87a175

WORKDIR /app

ARG PORTFOLIO_UID=10001
ARG PORTFOLIO_GID=10001

RUN groupadd --gid "${PORTFOLIO_GID}" portfolio \
    && useradd --uid "${PORTFOLIO_UID}" --gid portfolio --home-dir /app --no-create-home --shell /usr/sbin/nologin portfolio \
    && mkdir -p /srv/portfolio/data /srv/portfolio/backups \
    && chown -R portfolio:portfolio /app /srv/portfolio

COPY --from=build --chown=${PORTFOLIO_UID}:${PORTFOLIO_GID} /workspace/build/install/portfolio-api/ /app/

USER ${PORTFOLIO_UID}:${PORTFOLIO_GID}

EXPOSE 18082

ENTRYPOINT ["/app/bin/portfolio-api"]
