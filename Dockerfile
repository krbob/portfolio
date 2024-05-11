FROM eclipse-temurin:17-jre
CMD mkdir /src
COPY . /src

WORKDIR /src
RUN apt-get update &&  \
    apt-get install -y python3-pip --no-install-recommends &&  \
    apt-get clean &&  \
    rm -rf /var/lib/apt/lists/*
RUN pip3 install --no-cache-dir -r requirements.txt
RUN ./gradlew installDist --no-daemon && \
    cp -rf build/install/portfolio/bin/portfolio /bin/ &&  \
    cp -rf build/install/portfolio/lib/* /lib/ && \
    cp history.py /bin/ && \
    rm -rf /src /root/.cache /root/.gradle /root/.kotlin

EXPOSE 7777
ENTRYPOINT ["/bin/portfolio"]
