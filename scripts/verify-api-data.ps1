# Verify Block70 API has DB connection and data.
# Run from repo root. Requires: API running at $BaseUrl (default http://localhost:8000).

param(
    [string]$BaseUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"

Write-Host "Block70 API data verification" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host ""

# 1. Health
Write-Host "1. Health check..." -NoNewline
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method GET
    if ($health.status -eq "ok") { Write-Host " OK" -ForegroundColor Green } else { Write-Host " Unexpected: $health" -ForegroundColor Yellow }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "   Make sure the API is running: docker-compose up api  OR  uvicorn app.main:app --reload" -ForegroundColor Yellow
    exit 1
}

# 2. Bootstrap coins (sync from CoinGecko)
Write-Host "2. Bootstrap coins (sync from CoinGecko)..." -NoNewline
try {
    $boot = Invoke-RestMethod -Uri "$BaseUrl/api/v1/scan/bootstrap/coins" -Method POST
    Write-Host " OK" -ForegroundColor Green
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   If 404: rebuild API (docker-compose up --build api). If 500: check API logs and DATABASE_URL." -ForegroundColor Yellow
}

# 3. Count coins
Write-Host "3. GET /api/v1/coins..." -NoNewline
try {
    $coins = Invoke-RestMethod -Uri "$BaseUrl/api/v1/coins?limit=5" -Method GET
    $n = if ($coins -is [array]) { $coins.Count } else { 0 }
    Write-Host " $n coins" -ForegroundColor $(if ($n -gt 0) { "Green" } else { "Yellow" })
    if ($n -eq 0) {
        Write-Host "   Coins table is empty. Ensure: (1) API is connected to PostgreSQL (DATABASE_URL), (2) bootstrap step succeeded." -ForegroundColor Yellow
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "   Likely the API cannot reach the database. Set DATABASE_URL and restart the API." -ForegroundColor Yellow
}

# 4. Count opportunities (use /top which is public; list at /opportunities may require auth on some setups)
Write-Host "4. GET /api/v1/opportunities/top..." -NoNewline
try {
    $opps = Invoke-RestMethod -Uri "$BaseUrl/api/v1/opportunities/top?limit=5" -Method GET
    $n = if ($opps -is [array]) { $opps.Count } else { 0 }
    Write-Host " $n opportunities" -ForegroundColor $(if ($n -gt 0) { "Green" } else { "Yellow" })
    if ($n -eq 0) {
        Write-Host "   Run: Invoke-RestMethod -Uri '$BaseUrl/scan/arbitrage' -Method POST" -ForegroundColor Yellow
    }
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Yellow
}

# 5. Count AI insights
Write-Host "5. GET /api/v1/ai/insights/latest..." -NoNewline
try {
    $insights = Invoke-RestMethod -Uri "$BaseUrl/api/v1/ai/insights/latest?limit=5" -Method GET
    $n = if ($insights -is [array]) { $insights.Count } else { 0 }
    Write-Host " $n insights" -ForegroundColor $(if ($n -gt 0) { "Green" } else { "Yellow" })
} catch {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  - Data comes from the database. The API must have DATABASE_URL pointing to a running PostgreSQL."
Write-Host "  - Coins: populated by POST /api/v1/scan/bootstrap/coins (CoinGecko)."
Write-Host "  - Opportunities: populated by POST /scan/arbitrage or the scheduler (every 2 min)."
Write-Host "  - You do NOT need to deploy; run Postgres + API locally and run this script to verify."
Write-Host ""
