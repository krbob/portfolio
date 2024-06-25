FROM python:3 AS builder

WORKDIR /app

COPY requirements.txt .

RUN --mount=type=cache,target=/root/.cache/pip \
     pip install --no-cache-dir -r requirements.txt

COPY app.py .

RUN pyinstaller --onefile app.py

FROM debian:stable-slim

WORKDIR /app

RUN useradd -m portfolio

USER portfolio

COPY --from=builder /app/dist/app portfolio-backend

EXPOSE 7776

CMD ["./portfolio-backend"]