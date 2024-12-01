# Portfolio

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/krbob/portfolio/ci-build.yml)
![](https://img.shields.io/badge/kotlin-2.1.0-orange)
![](https://img.shields.io/badge/ktor-3.0.1-orange)
![](https://img.shields.io/badge/yfinance-0.2.50-orange)
![](https://img.shields.io/badge/ta4j-0.17-orange)

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
  "date": "2024-11-07",
  "lastPrice": 227.59500122070312,
  "gain": {
    "daily": 0.021888469707617982,
    "weekly": 0.007458711572215185,
    "monthly": 0.026636288124258535,
    "quarterly": 0.08471543835673422,
    "yearly": 0.2517599386895804
  },
  "rsi": {
    "daily": 49.477285056502865,
    "weekly": 58.69001539809558,
    "monthly": 66.7485882441636
  },
  "dividendYield": 0.004305894218870281,
  "peRatio": 27.388086,
  "pbRatio": 60.418106,
  "eps": 6.08,
  "roe": 1.5741299,
  "marketCap": 3440280340000
}
```

