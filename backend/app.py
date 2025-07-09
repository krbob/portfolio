import logging
import time
import traceback
import yfinance as yf
from dataclasses import dataclass
from flask import Flask, request, jsonify, g

app = Flask(__name__)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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


@dataclass
class BasicInfo:
    name: str
    pe_ratio: float
    pb_ratio: float
    eps: float
    roe: float
    market_cap: float

    def to_json(self):
        return {
            'name': self.name,
            'pe_ratio': self.pe_ratio,
            'pb_ratio': self.pb_ratio,
            'eps': self.eps,
            'roe': self.roe,
            'market_cap': self.market_cap
        }


def get_history(symbol, period):
    data = yf.Ticker(symbol)
    history = data.history(period=period, auto_adjust=False)
    dividends = data.dividends
    for index, row in history.iterrows():
        yield HistoricalPrice(
            date=index.strftime('%Y-%m-%d'),
            open=row['Open'],
            close=row['Close'],
            low=row['Low'],
            high=row['High'],
            volume=int(row['Volume']),
            dividend=dividends.loc[index] if index in dividends.index else 0.0
        )


def get_basic_info(symbol):
    data = yf.Ticker(symbol)
    info = data.info

    return BasicInfo(
        name=info.get('longName', None),
        pe_ratio=info.get('forwardPE', None),
        pb_ratio=info.get('priceToBook', None),
        eps=info.get('trailingEps', None),
        roe=info.get('returnOnEquity', None),
        market_cap=info.get('marketCap', None)
    )


@app.before_request
def start_timer():
    g.start_time = time.time()


@app.after_request
def log_request_info(response):
    if hasattr(g, 'start_time'):
        duration = time.time() - g.start_time
        duration_ms = int(duration * 1000)
        log_params = [
            request.method,
            request.path,
            response.status,
            f"{duration_ms}ms"
        ]
        logger.info(" ".join(log_params))

    return response


@app.after_request
def set_headers(response):
    response.headers['Content-Type'] = 'application/json; charset=UTF-8'
    response.headers['Cache-Control'] = 'public, max-age=60'
    return response


@app.errorhandler(Exception)
def handle_exception(e):
    tb = traceback.format_exc()
    logger.error(f"Exception: {str(e)}\n{tb}")
    return jsonify({"error": "An internal error occurred"}), 500


@app.route('/history/<string:symbol>/<string:period>', methods=['GET'])
def history_endpoint(symbol, period):
    if not symbol or not period:
        return jsonify({"error": "Parameters 'symbol' and 'period' are required"}), 400

    try:
        history = get_history(symbol, period)
    except Exception as e:
        logger.error(f"Error fetching history for {symbol} over period {period}: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

    return jsonify([day.to_json() for day in history])


@app.route('/info/<string:symbol>', methods=['GET'])
def info_endpoint(symbol):
    if not symbol:
        return jsonify({"error": "Parameter 'symbol' is required"}), 400

    try:
        info = get_basic_info(symbol)
    except Exception as e:
        logger.error(f"Error fetching info for {symbol}: {str(e)}")
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500

    return jsonify(info.to_json())


if __name__ == '__main__':
    from waitress import serve

    serve(app, host='0.0.0.0', port=7776)
