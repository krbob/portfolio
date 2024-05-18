FROM eclipse-temurin:17-jre

WORKDIR /app

COPY . /app

RUN ./gradlew installDist --no-daemon && \
    cp -rf build/install/portfolio/bin/portfolio /bin/ &&  \
    cp -rf build/install/portfolio/lib/* /lib/ && \
    rm -rf /src /root/.cache /root/.gradle /root/.kotlin

EXPOSE 7777

ENTRYPOINT ["/bin/portfolio"]
