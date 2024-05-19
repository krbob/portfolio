FROM eclipse-temurin:17-jdk as builder

WORKDIR /app

COPY . /app

RUN ./gradlew installDist --no-daemon

FROM eclipse-temurin:17-jre

COPY --from=builder /app/build/install/portfolio/bin /bin
COPY --from=builder  /app/build/install/portfolio/lib /lib

EXPOSE 7777

ENTRYPOINT ["portfolio"]