import yfinance as yf
from dataclasses import dataclass
import json


@dataclass
class HistoricalPrice:
    date: str
    open: float
    close: float
    low: float
    high: float
    volume: int
    dividend: float

    def to_json(self):
        return {
            'date': self.date,
            'open': self.open,
            'close': self.close,
            'low': self.low,
            'high': self.high,
            'volume': self.volume,
            'dividend': self.dividend
        }


def serialize(obj):
    if isinstance(obj, HistoricalPrice):
        return obj.to_json()
    return obj


def get_history(ticker, period):
    data = yf.Ticker(ticker)
    history = data.history(period=period, auto_adjust=False)
    days = []
    for index, row in history.iterrows():
        day = HistoricalPrice(
            date=index.strftime('%Y-%m-%d'),
            open=row['Open'],
            close=row['Close'],
            low=row['Low'],
            high=row['High'],
            volume=int(row['Volume']),
            dividend=data.dividends.loc[index] if index in data.dividends.index else 0.0
        )
        days.append(day)

    return json.dumps(days, default=serialize, indent=4)


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 3:
        print("Usage: python history.py <ticker> <period>")
        sys.exit(1)

    ticker = sys.argv[1]
    period = sys.argv[2]

    history = get_history(ticker, period)
    print(history)
