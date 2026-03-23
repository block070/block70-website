# CoinGecko Alternatives & Rate Limit Mitigation

CoinGecko free tier limits ~10–30 requests/minute. Block70 uses multiple sources:

## Data Source Strategy

| Data | Primary | Fallback |
|------|---------|----------|
| **Simple prices (BTC, SOL, etc.)** | Coinbase → Binance.US | CoinGecko |
| **Coins list, detail, charts** | CoinGecko | CMC, Redis cache |
| **Categories, trending** | CoinGecko | — |

## Free Alternatives

| Provider | Rate Limit | Best For | Auth |
|----------|------------|----------|------|
| **Coinbase API** | ~600 req/10s | **Primary** for spot prices; one call gets all via `/exchange-rates` | None |
| **CoinMarketCap** | ~30 req/min | Coins list (pages 6+), fallback | `CMC_API_KEY` |
| **Binance.US API** | High, free | Public market data – **allowed for US-based sites** (read-only, no auth) | None for public |
| **CryptoCompare** | Limited free | Historical OHLC, news | Free API key |

### Binance.US and US-Based Sites

**Binance.US** (US-regulated entity) offers public market data APIs with security type `NONE` – no API key or geo restrictions for read-only data. US-based sites can use Binance.US for market data (prices, order book, klines). Main Binance.com has different ToS for US users; Binance.US is the compliant option.

## Implemented

1. **Price resolver** (`price_resolver.py`) – unified chain: Coinbase → Binance.US → CoinGecko

2. **Coinbase connector** – `/v2/exchange-rates`, `/v2/prices/{pair}/spot`

3. **Binance.US connector** – `/api/v3/ticker/price` (all pairs or single); US-compliant, no auth

4. **CoinMarketCap fallback** – coins list pages 6+ when CoinGecko returns empty

5. **Redis chart cache** – reduce CoinGecko `/market_chart` calls

## Recommended .env

```env
# CoinMarketCap for coins list fallback
CMC_API_KEY=your_key

# Coinbase: no key needed, used as primary for prices
```

## Usage Strategy

1. **Simple prices**: Coinbase first → CoinGecko fallback.
2. **Coins list**: CoinGecko first 5 pages → CMC for pages 6+.
3. **Charts**: Redis cache; serve stale on 429.
4. **Scheduler**: Consider increasing intervals to reduce CoinGecko load.
