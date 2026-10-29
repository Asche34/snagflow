[string[]]$rtkCommandArguments = $args

$rtkProjectRoot = Split-Path -Parent $PSScriptRoot
$rtkBinary = if ($env:RTK_BIN) { $env:RTK_BIN } else { Join-Path $env:USERPROFILE '.local/bin/rtk.exe' }
if (-not (Test-Path -LiteralPath $rtkBinary)) {
  throw 'RTK is missing. Install rtk-ai/rtk or set RTK_BIN to the executable path.'
}

$rtkLocalData = Join-Path $rtkProjectRoot '.superpowers/rtk'
$rtkEnvironment = @{
  RTK_DB_PATH = Join-Path $rtkLocalData 'history.db'
  RTK_TEE_DIR = Join-Path $rtkLocalData 'tee'
  CLAUDE_CONFIG_DIR = Join-Path $rtkLocalData 'claude'
}
$rtkPrevious = @{}
New-Item -ItemType Directory -Force -Path $rtkEnvironment.CLAUDE_CONFIG_DIR | Out-Null
try {
  foreach ($rtkKey in $rtkEnvironment.Keys) {
    $rtkPrevious[$rtkKey] = [Environment]::GetEnvironmentVariable($rtkKey, 'Process')
    [Environment]::SetEnvironmentVariable($rtkKey, $rtkEnvironment[$rtkKey], 'Process')
  }
  & $rtkBinary @rtkCommandArguments
  $rtkResult = $LASTEXITCODE
} finally {
  foreach ($rtkKey in $rtkPrevious.Keys) {
    [Environment]::SetEnvironmentVariable($rtkKey, $rtkPrevious[$rtkKey], 'Process')
  }
}
exit $rtkResult
