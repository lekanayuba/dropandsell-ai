# eBay Refresh Token Generator
# Run this in PowerShell to get your EBAY_REFRESH_TOKEN
# Set these environment variables before running:
#   $env:EBAY_CLIENT_ID = "your-client-id"
#   $env:EBAY_CLIENT_SECRET = "your-client-secret"
#   $env:EBAY_RU_NAME = "your-ru-name"

$ClientId = $env:EBAY_CLIENT_ID
$ClientSecret = $env:EBAY_CLIENT_SECRET
$RuName = $env:EBAY_RU_NAME

if (-not $ClientId -or -not $ClientSecret) {
    Write-Host "ERROR: Set EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, and EBAY_RU_NAME environment variables" -ForegroundColor Red
    exit 1
}

$Scopes = [System.Web.HttpUtility]::UrlEncode("https://api.ebay.com/oauth/api_scope/sell.fulfillment https://api.ebay.com/oauth/api_scope/sell.inventory")
$RuNameEncoded = [System.Web.HttpUtility]::UrlEncode($RuName)

$AuthUrl = "https://auth.ebay.com/oauth2/authorize?client_id=$ClientId&response_type=code&redirect_uri=$RuNameEncoded&scope=$Scopes"

Write-Host "`nStep 1: Opening eBay authorization page in your browser..." -ForegroundColor Green
Write-Host "URL: $AuthUrl`n" -ForegroundColor Cyan
Start-Process $AuthUrl

Write-Host "Step 2: Sign in with your SELLER account and click Agree" -ForegroundColor Yellow
Write-Host "Step 3: After redirect, the page will fail to load - that's OK" -ForegroundColor Yellow
Write-Host "Step 4: Copy the FULL redirect URL from your browser's address bar" -ForegroundColor Yellow
Write-Host "     (it will have ?code=XXXXXXXXX in it)`n" -ForegroundColor Yellow

$redirectUrl = Read-Host "Paste the full redirect URL here"

# Extract the code
$code = $null
if ($redirectUrl -match "[?&]code=([^&]+)") {
    $code = $matches[1]
}

if (-not $code) {
    Write-Host "ERROR: Could not find authorization code in URL" -ForegroundColor Red
    exit 1
}

Write-Host "`nExchanging authorization code for tokens..." -ForegroundColor Green

$pair = "${ClientId}:${ClientSecret}"
$auth = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))

$body = @{
    grant_type = "authorization_code"
    code = $code
    redirect_uri = $RuName
}

try {
    $result = Invoke-RestMethod -Uri "https://api.ebay.com/identity/v1/oauth2/token" -Method Post -Headers @{Authorization = "Basic $auth"} -Body $body
    
    Write-Host "`n==================== SUCCESS ====================" -ForegroundColor Green
    Write-Host "`nCopy this line into your .env file:" -ForegroundColor White
    Write-Host "EBAY_REFRESH_TOKEN=$($result.refresh_token)" -ForegroundColor Cyan -BackgroundColor Black
    Write-Host "`n================================================" -ForegroundColor Green
    
    # Copy to clipboard
    $result.refresh_token | Set-Clipboard
    Write-Host "`n(Refresh token copied to clipboard!)" -ForegroundColor Gray
} catch {
    Write-Host "ERROR: Token exchange failed" -ForegroundColor Red
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $reader.BaseStream.Position = 0
    Write-Host "Details: $($reader.ReadToEnd())" -ForegroundColor Red
}

Read-Host "`nPress Enter to exit"
