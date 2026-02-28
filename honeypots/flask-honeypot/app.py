"""Flask HTTP Honeypot - captures all inbound HTTP requests"""
import logging
import os
from flask import Flask, request, jsonify

app = Flask(__name__)
# Trust the X-Forwarded-For header set by ngrok / reverse proxies
app.config['TRUSTED_PROXIES'] = 1

os.makedirs("/app/logs", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
    handlers=[
        logging.FileHandler("/app/logs/flask-honeypot.log"),
        logging.StreamHandler(),
    ],
)


def _real_ip() -> str:
    """Return the real client IP.

    When running behind ngrok (HTTP tunnel) the actual attacker IP is in
    X-Forwarded-For.  We take the leftmost value (original client) and
    fall back to remote_addr when the header is absent (direct connections).
    """
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr


@app.route("/", defaults={"path": ""}, methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
@app.route("/<path:path>",           methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
def catch_all(path):
    src = _real_ip()
    logging.info(f"Request from {src}: {request.method} {request.url}")
    logging.info(f"Headers: {dict(request.headers)}")
    logging.info(f"Data: {request.get_data(as_text=True)}")
    return jsonify({"status": "ok"}), 200


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"}), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=False)
