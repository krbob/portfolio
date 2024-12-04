# Portfolio

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/krbob/portfolio/ci-build.yml)

## About

This project provides a backend service designed to fetch both fundamental and technical analysis
indicators for use in spreadsheets. It is built using Kotlin and Python, leveraging Docker for
containerization.

## Installation

### Prerequisites

- Docker Compose

### Steps

1. Clone the repository:
    ```bash
    git clone https://github.com/krbob/portfolio.git
    cd portfolio
    ```
2. Start the Docker containers from pre-built images:
    ```bash
    docker compose up -d
    ```
   Or build and start the Docker containers:
    ```bash
    docker compose -f docker-compose-build.yml up --build -d
    ```

## Usage

Once the Docker containers are up and running, the services will be available on the following
ports:

- The main service runs on port `7777`.
- The backend service, which serves as the data source for analysis, runs on port `7776`. Note that
  it is only accessible within the Docker Compose stack and is not exposed to the external network.

### Example API Call

To fetch an indicator, you can use a tool like `curl`:

```bash
curl -X GET http://localhost:7777/analysis/aapl
```

Example output

```json
{
  "symbol": "aapl",
  "name": "Apple Inc.",
  "date": "2024-12-04",
  "lastPrice": 242.41,
  "gain": {
    "daily": 0,
    "weekly": 0.03,
    "monthly": 0.09,
    "quarterly": 0.1,
    "yearly": 0.28
  },
  "rsi": {
    "daily": 72.12,
    "weekly": 67.12,
    "monthly": 70.31
  },
  "dividendYield": 0.004,
  "peRatio": 29.18,
  "pbRatio": 64.35,
  "eps": 6.09,
  "roe": 1.57,
  "marketCap": 3664221000000
}
```

