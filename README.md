# Portfolio

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/krbob/portfolio/ci-build.yml)
![](https://img.shields.io/badge/kotlin-2.0.0-orange)
![](https://img.shields.io/badge/ktor-2.3.12-orange)
![](https://img.shields.io/badge/yfinance-0.2.40-orange)
![](https://img.shields.io/badge/ta4j-0.16-orange)

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
  "date": "2024-07-11",
  "lastPrice": 227.57000732421875,
  "gain": {
    "monthly": 0.09857597890125225,
    "quarterly": 0.30010292534813254,
    "yearly": 0.20996387233469124
  },
  "rsi": {
    "daily": 68.58256517392645,
    "weekly": 74.02993071489348,
    "monthly": 68.7392719437258
  },
  "dividendYield": 0.0042624246112451985,
  "peRatio": 31.131329,
  "pbRatio": 47.04776,
  "eps": 6.43,
  "roe": 1.4725,
  "marketCap": 3.48958124E12
}
```

