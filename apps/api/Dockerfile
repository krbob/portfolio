FROM gradle:9.7.1-jdk21@sha256:c0ce93e022ea2e705332dabe090019c749356576fc8fe39c38129b2aae9ed68f AS build

WORKDIR /workspace

COPY settings.gradle.kts settings.gradle.kts
COPY build.gradle.kts build.gradle.kts
COPY gradle gradle
COPY portfolio-domain portfolio-domain
COPY contracts contracts
COPY src src

RUN --mount=type=cache,target=/home/gradle/.gradle,uid=1000,gid=1000 \
    gradle --no-daemon installDist

FROM eclipse-temurin:21.0.12_8-jre-noble@sha256:96975602e131485862eb8cd32927face8a06d7591a5e865944b634a701d9df72

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

# The production Compose contract invokes curl; CI boots this image and verifies the health state.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=12 \
    CMD ["curl", "-fsS", "http://127.0.0.1:18082/v1/health"]

ENTRYPOINT ["/app/bin/portfolio-api"]
