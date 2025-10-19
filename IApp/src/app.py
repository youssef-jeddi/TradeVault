import json
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

# Helper you already have; reads entries from the protected dataset ZIP.
# We'll read ONE value: a string named "steps" that contains a JSON array of rule strings.
import protected_data


# =============================================================================
# iExec & external data configuration
# =============================================================================
# iExec output directory: we must write results here.
IEXEC_OUT = os.getenv("IEXEC_OUT", "/iexec_out")

# Maximum % any single action may instruct (BUY/SELL). Change via env on deployment.
MAX_POSITION_PERCENT = float(os.getenv("MAX_POSITION_PERCENT", "50"))

# Public BTC hourly (last 24h) prices via CoinGecko.
COINGECKO_URL = (
    "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart"
    "?vs_currency=usd&days=1&interval=hourly"
)


# =============================================================================
# Minimal HTTP JSON with fallback (requests -> urllib)
# =============================================================================
def http_get_json(url: str) -> Dict[str, Any]:
    """Fetch JSON from URL with a timeout; prefer requests, fall back to urllib."""
    try:
        import requests  # type: ignore
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception:
        import urllib.request
        req = urllib.request.Request(url, headers={"User-Agent": "iexec-iapp/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        return json.loads(data.decode("utf-8"))


# =============================================================================
# Load seller steps (single protected string: "steps" → JSON array of strings)
# =============================================================================
def load_steps_array() -> List[str]:
    """
    Preferred: a single protected string key 'steps' containing all steps (JSON array or multi-line text).
    Fallback: sequential keys 'step1','step2',... each containing one rule string.
    """
    # Try main key first
    try:
        raw = protected_data.getValue("steps", "string")
        try:
            arr = json.loads(raw)
            if isinstance(arr, list) and all(isinstance(s, str) for s in arr):
                return arr
        except Exception:
            pass
        # fallback for multi-line string
        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        if lines:
            return lines
        raise ValueError("Empty 'steps' entry.")
    except Exception:
        pass  # fallback to step1, step2, ...

    # fallback: step1, step2, ...
    collected = []
    idx = 1
    while True:
        key = f"step{idx}"
        try:
            s = protected_data.getValue(key, "string")
            if s and s.strip():
                collected.append(s.strip())
                idx += 1
            else:
                break
        except Exception:
            break
    if not collected:
        raise ValueError("No valid step data found (neither 'steps' nor 'stepN').")
    return collected




# =============================================================================
# Parse rule-strings into a normalized structure
# =============================================================================
# We accept two formats (case-insensitive):
#  1) ACTION if pct_change Wh >= X% then P%
#  2) ACTION if pct_change Wh in [A%, B%] then P%
# Where:
#   - ACTION ∈ {BUY, SELL, HOLD}
#   - W ∈ {1,2,4,6,12,24}
#   - X, A, B, P are floats; percentages may include a leading minus and decimals.

# Threshold rule: "... >= X%" or "... <= X%"
THRESHOLD_RE = re.compile(
    r"""^\s*
        (?P<action>buy|sell|hold)\s+if\s+pct_change\s+(?P<wh>\d+)\s*h\s*
        (?P<op>>=|<=)\s*
        (?P<thresh>-?\d+(?:\.\d+)?)\s*%\s*
        then\s*(?P<percent>\d+(?:\.\d+)?)\s*%\s*
        $""",
    re.IGNORECASE | re.VERBOSE,
)

# Range rule: "... in [A%, B%]"
RANGE_RE = re.compile(
    r"""^\s*
        (?P<action>buy|sell|hold)\s+if\s+pct_change\s+(?P<wh>\d+)\s*h\s*
        in\s*\[\s*(?P<low>-?\d+(?:\.\d+)?)\s*%\s*,\s*(?P<high>-?\d+(?:\.\d+)?)\s*%\s*\]\s*
        then\s*(?P<percent>\d+(?:\.\d+)?)\s*%\s*
        $""",
    re.IGNORECASE | re.VERBOSE,
)

def parse_rule(rule_str: str) -> Dict[str, Any]:
    """
    Parse a single rule string into a dict:
      {
        "action": "BUY"|"SELL"|"HOLD",
        "window_hours": int,
        "type": "threshold"|"range",
        "gte": float or None,
        "lte": float or None,
        "percent": float
      }
    Raises ValueError if the string doesn't match the supported formats.
    """
    m = THRESHOLD_RE.match(rule_str)
    if m:
        action = m.group("action").upper()
        wh = int(m.group("wh"))
        if wh not in (1, 2, 4, 6, 12, 24):
            raise ValueError(f"window_hours must be one of 1,2,4,6,12,24 (got {wh})")
        op = m.group("op")
        thresh = float(m.group("thresh"))
        percent = float(m.group("percent"))

        # Convert to unified constraints (gte/lte)
        gte = thresh if op == ">=" else None
        lte = thresh if op == "<=" else None

        return {
            "action": action,
            "window_hours": wh,
            "type": "threshold",
            "gte": gte,
            "lte": lte,
            "percent": percent,
        }

    m = RANGE_RE.match(rule_str)
    if m:
        action = m.group("action").upper()
        wh = int(m.group("wh"))
        if wh not in (1, 2, 4, 6, 12, 24):
            raise ValueError(f"window_hours must be one of 1,2,4,6,12,24 (got {wh})")
        low = float(m.group("low"))
        high = float(m.group("high"))
        if low > high:
            raise ValueError(f"range low cannot exceed high (got [{low}%, {high}%])")
        percent = float(m.group("percent"))
        return {
            "action": action,
            "window_hours": wh,
            "type": "range",
            "gte": low,
            "lte": high,
            "percent": percent,
        }

    raise ValueError(
        "Rule not recognized. Use either:\n"
        "  - 'BUY if pct_change 1h >= 0.5% then 10%'\n"
        "  - 'SELL if pct_change 6h in [-5%, -1.5%] then 20%'\n"
    )


# =============================================================================
# Market data (BTC hourly last ~24h)
# =============================================================================
def fetch_btc_hourly_prices() -> List[Tuple[int, float]]:
    """
    Fetches the last 24 hourly BTC/USD closing prices from CryptoCompare.
    Returns a list of (timestamp_ms, price).
    """
    url = "https://min-api.cryptocompare.com/data/v2/histohour?fsym=BTC&tsym=USD&limit=24"
    data = http_get_json(url)

    if data.get("Response") != "Success":
        raise RuntimeError(f"CryptoCompare error: {data.get('Message', 'unknown')}")

    candles = data["Data"]["Data"]
    if not isinstance(candles, list) or len(candles) < 2:
        raise RuntimeError("Unexpected CryptoCompare response format.")

    # convert to list of (timestamp_ms, close)
    prices: List[Tuple[int, float]] = [
        (int(c["time"]) * 1000, float(c["close"])) for c in candles if "close" in c
    ]
    if len(prices) < 2:
        raise RuntimeError("Insufficient price data from CryptoCompare.")

    return prices[-24:]


# =============================================================================
# Indicator & evaluation
# =============================================================================
def pct_change(prices: List[Tuple[int, float]], window_hours: int) -> Optional[float]:
    """
    % change over 'window_hours':
      pct = 100 * (last - ref) / ref
    'last' is the final element; 'ref' is window_hours steps earlier.
    """
    if len(prices) <= window_hours:
        return None
    last = prices[-1][1]
    ref = prices[-1 - window_hours][1]
    if ref == 0:
        return None
    return 100.0 * (last - ref) / ref


def evaluate_rules_now(
    prices: List[Tuple[int, float]],
    parsed_rules: List[Dict[str, Any]],
    max_position_percent: float,
) -> Dict[str, Any]:
    """
    Evaluate rules in order; the first satisfied rule determines the action.
    Action percent is clamped to [0, max_position_percent].
    Returns action/percent/matched_rule/indicator_value/explanations.
    """
    explanations: List[str] = []

    for r in parsed_rules:
        name = f"{r['action']} if pct_change {r['window_hours']}h"
        win = int(r["window_hours"])
        val = pct_change(prices, win)
        if val is None:
            explanations.append(f"[{name}] skipped: not enough data for {win}h window.")
            continue

        # Build boolean based on threshold/range (we already normalized to gte/lte).
        ok_gte = (r["gte"] is None) or (val >= float(r["gte"]))
        ok_lte = (r["lte"] is None) or (val <= float(r["lte"]))

        explanations.append(
            f"[{name}] => {val:.4f}% vs "
            f"gte={r['gte'] if r['gte'] is not None else '-'}, "
            f"lte={r['lte'] if r['lte'] is not None else '-'} "
            f"→ pass={ok_gte and ok_lte}"
        )

        if ok_gte and ok_lte:
            atype = r["action"]
            percent = max(0.0, min(float(r["percent"]), float(max_position_percent)))
            return {
                "action": atype,
                "percent": percent,
                "matched_rule": name,
                "indicator_value": val,
                "explanations": explanations,
            }

    explanations.append("No rule matched → default HOLD 0%.")
    return {
        "action": "HOLD",
        "percent": 0.0,
        "matched_rule": None,
        "indicator_value": None,
        "explanations": explanations,
    }


# =============================================================================
# iExec outputs
# =============================================================================
def write_iexec_outputs(result_obj: Dict[str, Any]) -> None:
    """
    Write:
      - result.json: machine-readable output
      - computed.json: manifest with deterministic-output-path → result.json
    """
    os.makedirs(IEXEC_OUT, exist_ok=True)
    result_path = os.path.join(IEXEC_OUT, "result.json")
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(result_obj, f, indent=2)
    with open(os.path.join(IEXEC_OUT, "computed.json"), "w", encoding="utf-8") as f:
        json.dump({"deterministic-output-path": result_path}, f)


# =============================================================================
# Main
# =============================================================================
def main() -> int:
    """
    Flow:
      1) Read 'steps' (JSON array of rule strings) from protected data.
      2) Parse each rule string into a normalized rule dict.
      3) Fetch BTC hourly prices for the last 24h.
      4) Evaluate rules (first match wins) to produce an immediate signal.
      5) Write iExec-compliant outputs (result.json + computed.json).
    """
    t0 = time.time()
    try:
        # 1) Load seller-specified rule strings
        rule_strings = load_steps_array()

        # 2) Parse to normalized rules
        parsed_rules = [parse_rule(s) for s in rule_strings]

        # 3) Market data
        prices = fetch_btc_hourly_prices()

        # 4) Decision now
        decision = evaluate_rules_now(
            prices=prices,
            parsed_rules=parsed_rules,
            max_position_percent=MAX_POSITION_PERCENT,
        )

        # 5) Emit outputs
        result = {
            "iapp": "strategy-executor-btc",
            "version": 1,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "market": "BTC-USD",
            "data_source": "CoinGecko /market_chart?days=1&interval=hourly",
            "lookback_hours": min(len(prices), 24),
            "latest_price": prices[-1][1],
            "recommendation": {
                "action": decision["action"],   # BUY / SELL / HOLD
                "percent": decision["percent"]  # clamped by MAX_POSITION_PERCENT
            },
            "matched_rule": decision["matched_rule"],
            "indicator_value_pct": decision["indicator_value"],
            "explanations": decision["explanations"],
            "audit": {
                "rule_count": len(parsed_rules),
                "max_position_percent": MAX_POSITION_PERCENT,
                "accepted_formats": [
                    "ACTION if pct_change Wh >= X% then P%",
                    "ACTION if pct_change Wh <= X% then P%",
                    "ACTION if pct_change Wh in [A%, B%] then P%",
                ],
            },
        }

        write_iexec_outputs(result)
        return 0

    except Exception as e:
        # Always produce machine-readable error output for iExec UX.
        err = {
            "iapp": "strategy-executor-btc",
            "version": 1,
            "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            "error": f"{type(e).__name__}: {e}",
        }
        try:
            write_iexec_outputs(err)
        except Exception:
            os.makedirs(IEXEC_OUT, exist_ok=True)
            with open(os.path.join(IEXEC_OUT, "computed.json"), "w", encoding="utf-8") as f:
                json.dump({"deterministic-output-path": IEXEC_OUT, "error": err["error"]}, f)
        return 1
    finally:
        print(f"[iApp] Finished in {int(time.time() - t0)}s.")


if __name__ == "__main__":
    raise SystemExit(main())
