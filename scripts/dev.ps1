#requires -Version 7.0
<#
  狩魂者车卡器本地启动脚本，由根目录 start.bat 调用。
  用法：pwsh -File scripts\dev.ps1 [menu|start|check|web|ai|stop|logs|health]
#>

param(
  [ValidateSet('menu', 'start', 'check', 'web', 'ai', 'stop', 'logs', 'health')]
  [string]$Mode = 'menu'
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot 'logs'
$WebPort = 3000
$AiPort = 4317
$WebBase = "http://localhost:$WebPort"
$AiBase = "http://127.0.0.1:$AiPort"

Set-Location $ProjectRoot
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch {
  # 少数宿主不支持修改编码，忽略即可
}

function Write-Title {
  param([string]$Text)
  Write-Host ''
  Write-Host "==== $Text ====" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Text)
  Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Text)
  Write-Host "[提示] $Text" -ForegroundColor Yellow
}

function Write-Err {
  param([string]$Text)
  Write-Host "[错误] $Text" -ForegroundColor Red
}

function Write-Info {
  param([string]$Text)
  Write-Host "      $Text" -ForegroundColor DarkGray
}

function Invoke-Npm {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$LogName
  )
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) { throw '未找到 npm.cmd，请确认 Node.js 安装完整。' }

  if ($LogName) {
    New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
    $logPath = Join-Path $LogDir $LogName
    & $npm.Source @Arguments 2>&1 | Tee-Object -FilePath $logPath -Append | Out-Host
  } else {
    & $npm.Source @Arguments 2>&1 | Out-Host
  }
  return $LASTEXITCODE
}

function Test-Environment {
  param(
    [switch]$AutoFix,
    [switch]$NeedMcp
  )

  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Err '未找到 Node.js，请安装 Node.js 20.9 或更高版本：https://nodejs.org/'
    return $false
  }
  $nodeVersionText = (& $node.Source -v).Trim()
  $nodeVersion = $null
  if (-not [version]::TryParse($nodeVersionText.TrimStart('v'), [ref]$nodeVersion)) {
    Write-Err "无法识别 Node.js 版本：$nodeVersionText"
    return $false
  }
  if ($nodeVersion -lt [version]'20.9.0') {
    Write-Err "Node.js 版本过低（$nodeVersionText），Next.js 16 需要 20.9 及以上。"
    return $false
  }
  Write-Ok "Node.js $nodeVersionText"

  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) {
    Write-Err '未找到 npm.cmd，请重新安装 Node.js。'
    return $false
  }
  Write-Ok "npm $((& $npm.Source -v).Trim())"

  if (-not (Test-Path (Join-Path $ProjectRoot 'content\report.json'))) {
    Write-Err '缺少 content\report.json，规则数据不完整，请检查仓库是否完整。'
    return $false
  }
  Write-Ok '内容数据 content\report.json 存在'

  $nextPkg = Join-Path $ProjectRoot 'node_modules\next\package.json'
  if (Test-Path $nextPkg) {
    Write-Ok '依赖已安装'
  } elseif ($AutoFix) {
    Write-Warn '未安装依赖，开始执行 npm install ...'
    $code = Invoke-Npm -Arguments @('install') -LogName 'npm-install.log'
    if ($code -ne 0 -or -not (Test-Path $nextPkg)) {
      Write-Err "依赖安装失败，详见日志：$LogDir\npm-install.log"
      return $false
    }
    Write-Ok '依赖安装完成'
  } else {
    Write-Warn '依赖未安装，运行 start.bat 或 npm install 安装'
  }

  $distEntry = Join-Path $ProjectRoot 'mcp\dist\server.js'
  if (Test-Path $distEntry) {
    Write-Ok 'MCP 产物 mcp\dist\server.js 存在'
  } elseif ($AutoFix -and $NeedMcp) {
    Write-Warn '未找到 mcp\dist，开始执行 npm run ai:build ...'
    $code = Invoke-Npm -Arguments @('run', 'ai:build') -LogName 'ai-build.log'
    if ($code -ne 0 -or -not (Test-Path $distEntry)) {
      Write-Warn "MCP 产物构建失败，网页与 AI 功能不受影响；详见 $LogDir\ai-build.log"
    } else {
      Write-Ok 'MCP 产物已构建（mcp\dist）'
    }
  } else {
    Write-Warn '未找到 mcp\dist，编辑器 MCP 需先运行 npm run ai:build'
  }

  return $true
}

function Get-PortOwner {
  param([int]$Port)

  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -First 1
    if ($conn) {
      $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
      $name = if ($proc) { $proc.ProcessName } else { 'unknown' }
      return [pscustomobject]@{
        Port = $Port
        Pid  = [int]$conn.OwningProcess
        Name = $name
      }
    }
  } catch {
    # Get-NetTCPConnection 不可用时回退 netstat
  }

  foreach ($line in (netstat -ano | Select-String -Pattern ":$Port\s")) {
    $text = $line.Line.Trim()
    if ($text -notmatch 'LISTENING') { continue }
    $parts = $text -split '\s+'
    $ownerPid = 0
    if (-not [int]::TryParse($parts[-1], [ref]$ownerPid)) { continue }
    $proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { 'unknown' }
    return [pscustomobject]@{
      Port = $Port
      Pid  = $ownerPid
      Name = $name
    }
  }
  return $null
}

function Resolve-PortConflict {
  param(
    [int]$Port,
    [string]$ServiceName
  )

  $owner = Get-PortOwner -Port $Port
  if (-not $owner) { return $true }

  Write-Warn "$ServiceName 端口 $Port 已被占用：PID $($owner.Pid)（$($owner.Name)）"
  if ([Console]::IsInputRedirected) {
    Write-Err '当前为非交互环境，无法确认是否结束占用进程，已退出。'
    return $false
  }

  $answer = Read-Host '是否结束该进程并继续？输入 y 确认，其他键退出'
  if ($answer -notmatch '^(y|yes)$') { return $false }

  try {
    taskkill /PID $owner.Pid /T /F 2>&1 | Out-Host
    Start-Sleep -Milliseconds 800
  } catch {
    Write-Err "结束进程失败：$($_.Exception.Message)"
    return $false
  }

  if (Get-PortOwner -Port $Port) {
    Write-Err "端口 $Port 仍被占用。"
    return $false
  }
  Write-Ok "已结束 PID $($owner.Pid)，端口 $Port 已释放"
  return $true
}

function Get-AiHealth {
  try {
    $resp = Invoke-WebRequest -Uri "$AiBase/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    $health = $resp.Content | ConvertFrom-Json
    if ($health.ok) { return $health }
  } catch {
    # 服务未启动时正常走这里
  }
  return $null
}

function Get-WebStatus {
  try {
    $resp = Invoke-WebRequest -Uri $WebBase -TimeoutSec 3 -UseBasicParsing -SkipHttpErrorCheck -ErrorAction Stop
    return [pscustomobject]@{
      StatusCode = [int]$resp.StatusCode
      IsOurs     = [bool]($resp.Content -match '狩魂者')
    }
  } catch {
    return $null
  }
}

function Start-BackgroundService {
  param(
    [string]$Name,
    [string[]]$NpmArguments,
    [string]$LogName
  )

  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $stdout = Join-Path $LogDir "$LogName.log"
  $stderr = Join-Path $LogDir "$LogName.err.log"
  Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue

  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) { throw '未找到 npm.cmd，请确认 Node.js 安装完整。' }

  $process = Start-Process -FilePath $npm.Source -ArgumentList $NpmArguments `
    -WorkingDirectory $ProjectRoot -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr -WindowStyle Hidden -PassThru

  Set-Content -Path (Join-Path $LogDir "$LogName.pid") -Value $process.Id -Encoding ascii
  Write-Info "$Name 启动中，PID $($process.Id)，日志 logs\$LogName.log"
  return $process
}

function Wait-AiReady {
  param(
    [System.Diagnostics.Process]$Process,
    [int]$TimeoutSeconds = 40
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $health = Get-AiHealth
    if ($health) { return $health }
    if ($Process -and $Process.HasExited) {
      Write-Warn "AI 服务进程提前退出（退出码 $($Process.ExitCode)）"
      return $null
    }
    Start-Sleep -Milliseconds 500
  }
  return $null
}

function Wait-WebReady {
  param(
    [System.Diagnostics.Process]$Process,
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $status = Get-WebStatus
    if ($status) { return $status }
    if ($Process -and $Process.HasExited) {
      Write-Warn "网页进程提前退出（退出码 $($Process.ExitCode)）"
      return $null
    }
    Start-Sleep -Milliseconds 800
  }
  return $null
}

function Show-LogTail {
  param(
    [string]$FileName,
    [int]$Lines = 25
  )

  $path = Join-Path $LogDir $FileName
  Write-Host "--- $FileName ---" -ForegroundColor DarkCyan
  if (-not (Test-Path $path)) {
    Write-Info '暂无该日志'
    return
  }
  Get-Content -Path $path -Tail $Lines -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
}

function Open-WebPage {
  if ($env:SH_NO_BROWSER -eq '1') {
    Write-Info '已跳过打开浏览器（SH_NO_BROWSER=1）'
    return
  }
  try {
    Start-Process $WebBase | Out-Null
  } catch {
    Write-Warn "打开浏览器失败：$($_.Exception.Message)"
  }
}

function Invoke-StartAll {
  Write-Title '环境检查'
  if (-not (Test-Environment -AutoFix -NeedMcp)) {
    throw '环境检查未通过，请按上面的提示处理后重试。'
  }

  Write-Title '端口与服务检查'
  $health = Get-AiHealth
  $reuseAi = $false
  if ($health) {
    $reuseAi = $true
    Write-Ok "AI 服务已在运行（PID $($health.pid)）"
  } elseif (Get-PortOwner -Port $AiPort) {
    if (-not (Resolve-PortConflict -Port $AiPort -ServiceName 'AI 服务')) {
      throw 'AI 服务端口冲突未解决。'
    }
  } else {
    Write-Ok "端口 $AiPort 可用"
  }

  $webStatus = Get-WebStatus
  $reuseWeb = $false
  if ($webStatus -and $webStatus.IsOurs) {
    $reuseWeb = $true
    Write-Ok "网页已在运行（HTTP $($webStatus.StatusCode)）"
  } elseif (Get-PortOwner -Port $WebPort) {
    if ($webStatus) {
      Write-Warn "端口 $WebPort 有响应，但不是本项目页面。"
    }
    if (-not (Resolve-PortConflict -Port $WebPort -ServiceName '网页')) {
      throw '网页端口冲突未解决。'
    }
  } else {
    Write-Ok "端口 $WebPort 可用"
  }

  Write-Title '启动服务'
  $aiHealth = $health
  if (-not $reuseAi) {
    $aiProcess = Start-BackgroundService -Name 'AI 服务' -NpmArguments @('run', 'ai') -LogName 'ai'
    $aiHealth = Wait-AiReady -Process $aiProcess -TimeoutSeconds 40
    if (-not $aiHealth) {
      Write-Err 'AI 服务未能正常启动。'
      Show-LogTail -FileName 'ai.err.log'
      Show-LogTail -FileName 'ai.log'
      throw 'AI 服务启动失败，请查看上面的日志。'
    }
  }
  Write-Ok "AI 服务就绪：$AiBase"

  if (-not $reuseWeb) {
    $webProcess = Start-BackgroundService -Name '网页' -NpmArguments @('run', 'dev') -LogName 'web'
    $webReady = Wait-WebReady -Process $webProcess -TimeoutSeconds 120
    if (-not $webReady) {
      Write-Err '网页未能正常启动。'
      Show-LogTail -FileName 'web.err.log'
      Show-LogTail -FileName 'web.log'
      throw '网页启动失败（AI 服务仍在后台运行，可运行 start.bat stop 停止）。'
    }
  }
  Write-Ok "网页就绪：$WebBase"

  Open-WebPage

  Write-Title '启动完成'
  Write-Info "网页：$WebBase"
  Write-Info "AI 服务：$AiBase/health"
  Write-Info "AI token：$($aiHealth.token)"
  Write-Info "AI revision：$($aiHealth.revision)，面板已连接：$($aiHealth.panelConnected)"
  Write-Info "日志目录：$LogDir"
  Write-Info 'MCP：编辑器中的 soul-hunter-ai 会复用此 AI 服务，stdio 入口为 mcp\dist\server.js'
  Write-Info '停止服务：start.bat stop，或重新运行后选择 6'
}

function Invoke-StartWeb {
  Write-Title '环境检查'
  if (-not (Test-Environment -AutoFix)) {
    throw '环境检查未通过，请按上面的提示处理后重试。'
  }

  $webStatus = Get-WebStatus
  if ($webStatus -and $webStatus.IsOurs) {
    Write-Ok "网页已在运行（HTTP $($webStatus.StatusCode)）"
    Open-WebPage
    return
  }
  if (Get-PortOwner -Port $WebPort) {
    if (-not (Resolve-PortConflict -Port $WebPort -ServiceName '网页')) {
      throw '网页端口冲突未解决。'
    }
  }

  Write-Title '启动网页'
  $webProcess = Start-BackgroundService -Name '网页' -NpmArguments @('run', 'dev') -LogName 'web'
  $webReady = Wait-WebReady -Process $webProcess -TimeoutSeconds 120
  if (-not $webReady) {
    Write-Err '网页未能正常启动。'
    Show-LogTail -FileName 'web.err.log'
    Show-LogTail -FileName 'web.log'
    throw '网页启动失败，请查看上面的日志。'
  }

  Write-Ok "网页就绪：$WebBase"
  Open-WebPage
  Write-Info "日志：$LogDir\web.log"
}

function Invoke-StartAi {
  Write-Title '环境检查'
  if (-not (Test-Environment -AutoFix -NeedMcp)) {
    throw '环境检查未通过，请按上面的提示处理后重试。'
  }

  $health = Get-AiHealth
  if ($health) {
    Write-Ok "AI 服务已在运行（PID $($health.pid)）"
    Write-Info "健康检查：$AiBase/health"
    return
  }
  if (Get-PortOwner -Port $AiPort) {
    if (-not (Resolve-PortConflict -Port $AiPort -ServiceName 'AI 服务')) {
      throw 'AI 服务端口冲突未解决。'
    }
  }

  Write-Title '启动 AI 服务'
  $aiProcess = Start-BackgroundService -Name 'AI 服务' -NpmArguments @('run', 'ai') -LogName 'ai'
  $health = Wait-AiReady -Process $aiProcess -TimeoutSeconds 40
  if (-not $health) {
    Write-Err 'AI 服务未能正常启动。'
    Show-LogTail -FileName 'ai.err.log'
    Show-LogTail -FileName 'ai.log'
    throw 'AI 服务启动失败，请查看上面的日志。'
  }

  Write-Ok "AI 服务就绪：$AiBase"
  Write-Info "token：$($health.token)"
  Write-Info "日志：$LogDir\ai.log"
  Write-Info 'MCP：编辑器中的 soul-hunter-ai 会自动复用该服务'
}

function Invoke-Check {
  Write-Title '环境'
  $envOk = Test-Environment -NeedMcp
  if (-not $envOk) {
    Write-Warn '环境检查未通过，重新运行 start.bat 可自动补齐依赖。'
  }

  Write-Title '端口'
  foreach ($item in @(
      @{ Port = $WebPort; Name = '网页' },
      @{ Port = $AiPort; Name = 'AI 服务' }
    )) {
    $owner = Get-PortOwner -Port $item.Port
    if ($owner) {
      Write-Info "$($item.Name)端口 $($item.Port) 被 PID $($owner.Pid)（$($owner.Name)）占用"
    } else {
      Write-Info "$($item.Name)端口 $($item.Port) 空闲"
    }
  }

  Write-Title '服务状态'
  $health = Get-AiHealth
  if ($health) {
    Write-Ok "AI 服务运行中：PID $($health.pid)，revision $($health.revision)，面板已连接：$($health.panelConnected)"
  } else {
    Write-Warn 'AI 服务未运行或健康检查失败'
  }

  $webStatus = Get-WebStatus
  if ($webStatus) {
    Write-Ok "网页响应正常（HTTP $($webStatus.StatusCode)）"
  } else {
    Write-Warn '网页未响应'
  }

  Write-Info "日志目录：$LogDir"
}

function Invoke-Health {
  $health = Get-AiHealth
  if (-not $health) {
    Write-Warn 'AI 服务未运行或健康检查失败。'
    $owner = Get-PortOwner -Port $AiPort
    if ($owner) {
      Write-Info "端口 $AiPort 被 PID $($owner.Pid)（$($owner.Name)）占用"
    }
    return
  }

  Write-Title 'AI 服务健康信息'
  $health | Format-List | Out-Host

  $webStatus = Get-WebStatus
  if ($webStatus) {
    Write-Ok "网页响应正常（HTTP $($webStatus.StatusCode)）"
  } else {
    Write-Warn '网页未响应'
  }
}

function Invoke-Logs {
  Write-Title '日志目录'
  if (-not (Test-Path $LogDir)) {
    Write-Info '暂无日志，先启动一次服务。'
    return
  }

  $files = Get-ChildItem -Path $LogDir -File | Sort-Object LastWriteTime -Descending
  if ($files.Count -eq 0) {
    Write-Info '暂无日志文件。'
    return
  }

  foreach ($file in $files) {
    Write-Host ("  {0,-18} {1,8} KB  {2:yyyy-MM-dd HH:mm:ss}" -f `
        $file.Name, [math]::Round($file.Length / 1KB, 1), $file.LastWriteTime)
  }

  Write-Host ''
  foreach ($name in @('web.err.log', 'web.log', 'ai.err.log', 'ai.log')) {
    $path = Join-Path $LogDir $name
    if (-not (Test-Path $path)) { continue }
    Write-Host "--- $name（最后 20 行）---" -ForegroundColor DarkCyan
    Get-Content -Path $path -Tail 20 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ }
  }
}

function Invoke-Stop {
  $targets = [System.Collections.Generic.List[object]]::new()

  foreach ($name in @('web', 'ai')) {
    $pidFile = Join-Path $LogDir "$name.pid"
    if (-not (Test-Path $pidFile)) { continue }
    $servicePid = 0
    $raw = Get-Content -Path $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not [int]::TryParse([string]$raw, [ref]$servicePid)) { continue }
    $proc = Get-Process -Id $servicePid -ErrorAction SilentlyContinue
    if (-not $proc) {
      Remove-Item $pidFile -ErrorAction SilentlyContinue
      continue
    }
    if ($proc.ProcessName -notin @('node', 'cmd', 'npm')) {
      Write-Warn "PID $servicePid 已不是预期进程（$($proc.ProcessName)），跳过"
      Remove-Item $pidFile -ErrorAction SilentlyContinue
      continue
    }
    $targets.Add([pscustomobject]@{ Pid = $servicePid; Name = "$name（$($proc.ProcessName)）" })
  }

  foreach ($port in @($WebPort, $AiPort)) {
    $owner = Get-PortOwner -Port $port
    if (-not $owner) { continue }
    if ($targets | Where-Object { $_.Pid -eq $owner.Pid }) { continue }
    $targets.Add([pscustomobject]@{ Pid = $owner.Pid; Name = "端口 $port（$($owner.Name)）" })
  }

  if ($targets.Count -eq 0) {
    Write-Info "未发现占用 $WebPort/$AiPort 的进程。"
    return
  }

  Write-Title '准备停止以下进程'
  foreach ($target in $targets) {
    Write-Host "  PID $($target.Pid)  $($target.Name)"
  }
  $answer = Read-Host '确认停止？输入 y 确认，其他键取消'
  if ($answer -notmatch '^(y|yes)$') {
    Write-Info '已取消。'
    return
  }

  foreach ($target in $targets) {
    taskkill /PID $target.Pid /T /F 2>&1 | Out-Host
  }

  Remove-Item (Join-Path $LogDir 'web.pid'), (Join-Path $LogDir 'ai.pid') -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 600

  foreach ($port in @($WebPort, $AiPort)) {
    if (Get-PortOwner -Port $port) {
      Write-Warn "端口 $port 仍被占用"
    } else {
      Write-Ok "端口 $port 已释放"
    }
  }
}

function Read-MenuChoice {
  param([int]$TimeoutSeconds = 5)

  $valid = @('1', '2', '3', '4', '5', '6', '7')
  try {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
      if ([Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true)
        if ($key.KeyChar -in $valid) { return [string]$key.KeyChar }
      }
      Start-Sleep -Milliseconds 150
    }
    return '1'
  } catch {
    try {
      $answer = Read-Host '请选择 [1-7]，直接回车执行 1'
      if ($answer -in $valid) { return $answer }
    } catch {
      # 无交互控制台时按默认处理
    }
    return '1'
  }
}

function Show-Menu {
  Write-Host ''
  Write-Host '  狩魂者车卡器 · 本地启动工具' -ForegroundColor Cyan
  Write-Host '  ----------------------------------------'
  Write-Host '   1  一键启动（网页 + AI 服务）'
  Write-Host '   2  环境自检（版本 / 依赖 / 端口 / 服务）'
  Write-Host '   3  仅启动网页'
  Write-Host '   4  仅启动 AI 服务（MCP 后端）'
  Write-Host '   5  查看日志'
  Write-Host '   6  停止本机服务'
  Write-Host '   7  查看 AI 健康状态'
  Write-Host '  ----------------------------------------'
  Write-Host '  5 秒后自动执行 1，按数字键立即选择' -ForegroundColor DarkGray
  return Read-MenuChoice
}

try {
  switch ($Mode) {
    'menu' {
      $choice = Show-Menu
      switch ($choice) {
        '1' { Invoke-StartAll }
        '2' { Invoke-Check }
        '3' { Invoke-StartWeb }
        '4' { Invoke-StartAi }
        '5' { Invoke-Logs }
        '6' { Invoke-Stop }
        '7' { Invoke-Health }
      }
    }
    'start' { Invoke-StartAll }
    'check' { Invoke-Check }
    'web' { Invoke-StartWeb }
    'ai' { Invoke-StartAi }
    'stop' { Invoke-Stop }
    'logs' { Invoke-Logs }
    'health' { Invoke-Health }
  }
} catch {
  Write-Host ''
  Write-Err $_.Exception.Message
  Write-Info "日志目录：$LogDir"
  exit 1
}
