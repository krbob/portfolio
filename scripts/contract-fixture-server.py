#!/usr/bin/env python3

"""Deterministic Stock Analyst / EDO HTTP fixtures for strict ecosystem smoke tests."""

import argparse
import datetime as dt
import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional
from urllib.parse import parse_qs, unquote, urlparse


def parse_date(value: Optional[str], default: dt.date) -> dt.date:
    return dt.date.fromisoformat(value) if value else default


def date_range(start: dt.date, end: dt.date):
    current = start
    while current <= end:
        yield current
        current += dt.timedelta(days=1)


def add_month(value: dt.date) -> dt.date:
    return dt.date(value.year + (value.month // 12), (value.month % 12) + 1, 1)


def month_range(start: dt.date, end_exclusive: dt.date):
    current = start.replace(day=1)
    while current < end_exclusive.replace(day=1):
        yield current
        current = add_month(current)


class FixtureHandler(BaseHTTPRequestHandler):
    server_version = "portfolio-contract-fixture/1"

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        parsed = urlparse(self.path)
        self.server.request_counts[parsed.path] = self.server.request_counts.get(parsed.path, 0) + 1
        if parsed.path == "/__requests":
            self.respond(self.server.request_counts)
            return
        if self.server.fixture_kind == "stock":
            self.stock_response(parsed)
        else:
            self.edo_response(parsed)

    def stock_response(self, parsed) -> None:
        if parsed.path in {"/health", "/healthz", "/readyz"}:
            self.respond({"status": "UP"})
            return
        if parsed.path.startswith("/v1/quote/"):
            symbol = unquote(parsed.path.removeprefix("/v1/quote/"))
            query = parse_qs(parsed.query)
            currency = query.get("currency", [None])[0] or ("PLN" if symbol in {"PLN=X", "USDPLN=X"} else "USD")
            price = self.stock_price(symbol, currency)
            today = dt.date.today()
            self.respond({
                "symbol": symbol,
                "name": f"Contract fixture {symbol}",
                "currency": currency,
                "date": today.isoformat(),
                "lastPrice": price,
                "previousClose": price - 1.0,
                "gain": {"daily": 0.2},
                "provenance": self.provenance(currency, today, today),
            })
            return
        if parsed.path.startswith("/v1/history/"):
            symbol = unquote(parsed.path.removeprefix("/v1/history/"))
            query = parse_qs(parsed.query)
            today = dt.date.today()
            start = parse_date(query.get("from", [None])[0], today - dt.timedelta(days=365))
            end = parse_date(query.get("to", [None])[0], today)
            if end < start:
                self.respond({"error": "invalid date range"}, HTTPStatus.BAD_REQUEST)
                return
            currency = query.get("currency", [None])[0] or ("PLN" if symbol in {"PLN=X", "USDPLN=X"} else "USD")
            close = self.stock_price(symbol, currency)
            prices = [{
                "date": day.isoformat(),
                "open": close,
                "close": close,
                "low": close,
                "high": close,
                "volume": 1000,
                "dividend": 0.0,
                "splitRatio": 1.0,
            } for day in date_range(start, end)]
            self.respond({
                "symbol": symbol,
                "name": f"Contract fixture {symbol}",
                "period": query.get("period", ["max"])[0],
                "interval": query.get("interval", ["1d"])[0],
                "currency": currency,
                "requestedFrom": start.isoformat(),
                "requestedTo": end.isoformat(),
                "prices": prices,
                "adjustment": "split-adjusted",
                "provenance": self.provenance(currency, start, end),
            })
            return
        self.respond({"error": "unknown stock fixture path"}, HTTPStatus.NOT_FOUND)

    def edo_response(self, parsed) -> None:
        if parsed.path in {"/health", "/healthz", "/readyz"}:
            self.respond({"status": "UP"})
            return
        query = parse_qs(parsed.query)
        today = dt.date.today()
        if parsed.path in {"/v1/edo/value", "/v1/edo/value/at"}:
            as_of = today
            if parsed.path.endswith("/at"):
                as_of = dt.date(
                    int(query["asOfYear"][0]),
                    int(query["asOfMonth"][0]),
                    int(query["asOfDay"][0]),
                )
            self.respond({
                "asOf": as_of.isoformat(),
                "edoValue": {
                    "totalValue": "110.00",
                    "periods": [{"daysInPeriod": 365, "daysElapsed": 100, "ratePercent": "6.80"}],
                },
            })
            return
        if parsed.path == "/v1/edo/history":
            start = dt.date(
                int(query.get("fromYear", [today.year])[0]),
                int(query.get("fromMonth", [today.month])[0]),
                int(query.get("fromDay", [today.day])[0]),
            )
            end = dt.date(
                int(query.get("toYear", [today.year])[0]),
                int(query.get("toMonth", [today.month])[0]),
                int(query.get("toDay", [today.day])[0]),
            )
            self.respond({
                "points": [{"date": day.isoformat(), "totalValue": "110.00"} for day in date_range(start, end)]
            })
            return
        if parsed.path == "/v1/inflation/since":
            start = dt.date(int(query["year"][0]), int(query["month"][0]), 1)
            self.respond({"from": start.strftime("%Y-%m"), "until": today.strftime("%Y-%m"), "multiplier": "1.0500"})
            return
        if parsed.path == "/v1/inflation/monthly":
            start = dt.date(int(query["startYear"][0]), int(query["startMonth"][0]), 1)
            end = dt.date(int(query["endYear"][0]), int(query["endMonth"][0]), 1)
            self.respond({
                "from": start.strftime("%Y-%m"),
                "until": end.strftime("%Y-%m"),
                "points": [
                    {"month": month.strftime("%Y-%m"), "multiplier": "1.0020"}
                    for month in month_range(start, end)
                ],
            })
            return
        self.respond({"error": "unknown EDO fixture path"}, HTTPStatus.NOT_FOUND)

    @staticmethod
    def stock_price(symbol: str, currency: str) -> float:
        if symbol in {"PLN=X", "USDPLN=X"}:
            return 4.0
        return 500.0 if currency == "PLN" else 123.45

    @staticmethod
    def provenance(currency: str, start: dt.date, end: dt.date) -> dict:
        return {
            "source": "CONTRACT_FIXTURE",
            "retrievedAt": f"{end.isoformat()}T12:00:00Z",
            "marketTimestamp": f"{end.isoformat()}T12:00:00Z",
            "marketDate": end.isoformat(),
            "currency": currency,
            "unitScale": 1.0,
            "adjustment": "SPLIT_ADJUSTED",
            "coverageFrom": start.isoformat(),
            "coverageTo": end.isoformat(),
            "status": "FRESH",
        }

    def respond(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Portfolio-Contract-Fixture", self.server.fixture_kind)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args) -> None:
        return


class FixtureServer(ThreadingHTTPServer):
    allow_reuse_address = True

    def __init__(self, address, handler, fixture_kind: str):
        super().__init__(address, handler)
        self.fixture_kind = fixture_kind
        self.request_counts: dict[str, int] = {}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=("stock", "edo"), required=True)
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()
    FixtureServer(("0.0.0.0", args.port), FixtureHandler, args.kind).serve_forever()


if __name__ == "__main__":
    main()
