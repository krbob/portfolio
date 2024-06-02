FROM python:3 as builder

WORKDIR /app

COPY . /app

RUN pip install --no-cache-dir -r requirements.txt

RUN pyinstaller -y app.py

FROM python:3-slim

WORKDIR /app

COPY --from=builder /app/dist/app /app

EXPOSE 7776

ENTRYPOINT ["./app"]