from flask import Flask, request, jsonify
import yfinance as yf
import requests_cache
from dataclasses import dataclass

app = Flask(__name__)

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

def get_history(symbol, period):
    session = requests_cache.CachedSession('yfinance_cache', backend='sqlite', expire_after=1800)
    session.headers['User-agent'] = 'portfolio/1.0'

    data = yf.Ticker(symbol, session=session)
    history = data.history(period=period, auto_adjust=False)
    dividends = data.dividends
    days = [
        HistoricalPrice(
            date=index.strftime('%Y-%m-%d'),
            open=row['Open'],
            close=row['Close'],
            low=row['Low'],
            high=row['High'],
            volume=int(row['Volume']),
            dividend=dividends.loc[index] if index in dividends.index else 0.0
        )
        for index, row in history.iterrows()
    ]

    return days

@app.route('/history', methods=['GET'])
def history_endpoint():
    symbol = request.args.get('symbol')
    period = request.args.get('period')

    if not symbol or not period:
        return jsonify({"error": "Parameters 'symbol' and 'period' are required"}), 400

    try:
        history = get_history(symbol, period)
    except yf.shared.exceptions.YFinanceError as e:
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

    return jsonify([day.to_json() for day in history])

if __name__ == '__main__':
    from waitress import serve
    serve(app, host='0.0.0.0', port=7776)