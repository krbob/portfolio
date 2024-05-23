FROM eclipse-temurin:17-jdk as builder

WORKDIR /app

COPY . /app

RUN ./gradlew installDist --no-daemon

FROM eclipse-temurin:17-jre

WORKDIR /app

COPY --from=builder /app/build/install/portfolio /app

EXPOSE 7777

ENTRYPOINT ["./bin/portfolio"]