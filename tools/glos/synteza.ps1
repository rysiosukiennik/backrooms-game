# Synteza mowy przez SAPI (System.Speech) -> pliki WAV (22,05 kHz, mono, 16 bit).
# Uzycie (tryb wsadowy, jedno uruchomienie na wiele linii):
#   powershell -NoProfile -ExecutionPolicy Bypass -File synteza.ps1 -Jobs jobs.json -OutDir katalog
#   jobs.json (UTF-8): [ { "out": "nazwa.wav", "text": "...", "rate": 0, "volume": 100 }, ... ]
# Tryb pojedynczy:
#   powershell -NoProfile -ExecutionPolicy Bypass -File synteza.ps1 -Text "Czesc" -Out czesc.wav -Rate 1 -Volume 100
# Rate: -10..10 (tempo SAPI), Volume: 0..100. Glos domyslnie "Microsoft Paulina Desktop".
param(
  [string]$Jobs = '',
  [string]$OutDir = '.',
  [string]$Text = '',
  [string]$Out = '',
  [int]$Rate = 0,
  [int]$Volume = 100,
  [string]$Voice = 'Microsoft Paulina Desktop',
  [int]$SampleRate = 22050,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $synth.SelectVoice($Voice) } catch { Write-Error ("Brak glosu: " + $Voice); exit 2 }
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo($SampleRate, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)

function Render([string]$t, [string]$path, [int]$rate, [int]$vol) {
  if ($rate -lt -10) { $rate = -10 }
  if ($rate -gt 10) { $rate = 10 }
  $synth.Rate = $rate
  $synth.Volume = [Math]::Max(0, [Math]::Min(100, $vol))
  $synth.SetOutputToWaveFile($path, $fmt)
  try { $synth.Speak($t) } finally { $synth.SetOutputToNull() }
}

if ($Jobs -ne '') {
  $json = [System.IO.File]::ReadAllText((Resolve-Path $Jobs), [System.Text.Encoding]::UTF8)
  $list = @(ConvertFrom-Json $json)
  if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
  $dir = (Resolve-Path $OutDir).Path
  $k = 0
  foreach ($j in $list) {
    $k++
    $path = Join-Path $dir $j.out
    if ((Test-Path $path) -and -not $Force) { continue }
    $r = 0; if ($null -ne $j.rate) { $r = [int]$j.rate }
    $v = 100; if ($null -ne $j.volume) { $v = [int]$j.volume }
    Render ([string]$j.text) $path $r $v
    if (($k % 25) -eq 0) { Write-Output ("synteza: {0}/{1}" -f $k, $list.Count) }
  }
  Write-Output ("synteza: gotowe ({0} linii)" -f $list.Count)
}
elseif ($Text -ne '' -and $Out -ne '') {
  $full = [System.IO.Path]::GetFullPath($Out)
  Render $Text $full $Rate $Volume
  Write-Output ("zapisano " + $full)
}
else {
  Write-Error 'Podaj -Jobs/-OutDir albo -Text/-Out.'
  exit 1
}
$synth.Dispose()
