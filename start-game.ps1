$ErrorActionPreference = 'Stop'
$taskPort = 8022
$taskPlayUrl = "http://127.0.0.1:$taskPort/play.html"
$taskTitle = 'ボンバーディフューザー3Dオンライン'
$taskLogDirectory = Join-Path $PSScriptRoot '.sites-runtime'
$taskOutLog = Join-Path $taskLogDirectory 'launcher.stdout.log'
$taskErrorLog = Join-Path $taskLogDirectory 'launcher.stderr.log'

function Test-GameReady([int]$TimeoutSeconds = 2) {
  try {
    $taskResponse = Invoke-WebRequest -Uri $taskPlayUrl -TimeoutSec $TimeoutSeconds -UseBasicParsing
    $taskTitlePattern = '<title>\s*' + [regex]::Escape($taskTitle) + '\s*</title>'
    return $taskResponse.StatusCode -eq 200 -and $taskResponse.Content -match $taskTitlePattern -and $taskResponse.Content -match '<canvas\b[^>]*\bid=["'']game["'']'
  } catch { return $false }
}

try {
  $taskReady = Test-GameReady
  if (-not $taskReady) {
    $taskNode = (Get-Command 'node.exe' -ErrorAction Stop).Source
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules/vinext/dist/cli.js'))) {
      throw '必要なファイルがありません。このフォルダーで npm install を実行してください。'
    }
    New-Item -ItemType Directory -Force -Path $taskLogDirectory | Out-Null
    $taskProcess = Start-Process -FilePath $taskNode -ArgumentList @('scripts/run-framework.mjs', 'dev', '--port', "$taskPort") -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput $taskOutLog -RedirectStandardError $taskErrorLog -PassThru
    $taskDeadline = [DateTime]::UtcNow.AddSeconds(30)
    while (-not $taskReady) {
      $taskSecondsLeft = [int][Math]::Floor(($taskDeadline - [DateTime]::UtcNow).TotalSeconds)
      if ($taskSecondsLeft -lt 1) { break }
      $taskReady = Test-GameReady -TimeoutSeconds ([Math]::Min(2, $taskSecondsLeft))
      if ($taskReady) { break }
      $taskProcess.Refresh()
      if ($taskProcess.HasExited) { break }
      Start-Sleep -Milliseconds 250
    }
  }
  if (-not $taskReady) {
    throw "30秒以内にゲームの起動を確認できませんでした。ポート $taskPort が使用中でないか、README の起動手順と $taskErrorLog を確認してください。"
  }
  Start-Process -FilePath $taskPlayUrl
} catch {
  $taskErrorMessage = $_.Exception.Message
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($taskErrorMessage, $taskTitle) | Out-Null
  } catch { Write-Error $taskErrorMessage }
  exit 1
}
