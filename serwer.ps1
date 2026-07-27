# Mały serwer plików dla gry NAREW.
# Potrzebny tylko po to, żeby odtwarzacz YouTube działał w oknie gry —
# przy otwieraniu pliku z dysku (file://) YouTube odmawia odtwarzania.
# Uruchomienie: kliknij prawym na ten plik → "Uruchom w programie PowerShell",
# albo w terminalu:  powershell -ExecutionPolicy Bypass -File serwer.ps1

$port = 8080
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:$port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Host "Nie udalo sie zajac portu $port." -ForegroundColor Red
    Write-Host "Sprobuj zmienic `$port na inny (np. 8090) w tym pliku." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "  Serwer dziala." -ForegroundColor Green
Write-Host "  Otworz w przegladarce:  $prefix" + "narew.html" -ForegroundColor Cyan
Write-Host "  Zatrzymanie: Ctrl+C w tym oknie."
Write-Host ""

$typy = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $sciezka = [System.Uri]::UnescapeDataString($ctx.Request.Url.LocalPath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($sciezka)) { $sciezka = 'narew.html' }
    $plik = Join-Path $root $sciezka

    # nie wypuszczamy niczego spoza katalogu gry
    $pelny = [System.IO.Path]::GetFullPath($plik)
    if (-not $pelny.StartsWith([System.IO.Path]::GetFullPath($root))) {
        $ctx.Response.StatusCode = 403
        $ctx.Response.Close()
        continue
    }

    if (Test-Path -LiteralPath $pelny -PathType Leaf) {
        $bajty = [System.IO.File]::ReadAllBytes($pelny)
        $ext = [System.IO.Path]::GetExtension($pelny).ToLower()
        $ctx.Response.ContentType = if ($typy.ContainsKey($ext)) { $typy[$ext] } else { 'application/octet-stream' }
        # bez tego przegladarka trzyma stara wersje gry w pamieci podrecznej
        $ctx.Response.Headers.Add('Cache-Control', 'no-store, no-cache, must-revalidate')
        $ctx.Response.Headers.Add('Pragma', 'no-cache')
        $ctx.Response.ContentLength64 = $bajty.Length
        $ctx.Response.OutputStream.Write($bajty, 0, $bajty.Length)
        Write-Host ("  200  " + $sciezka)
    } else {
        $ctx.Response.StatusCode = 404
        Write-Host ("  404  " + $sciezka) -ForegroundColor DarkYellow
    }
    $ctx.Response.Close()
}
