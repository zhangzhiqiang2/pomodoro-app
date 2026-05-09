$dir = (Get-Item .).Name
$model = if ($env:CLAUDE_MODEL) { $env:CLAUDE_MODEL } else { "Claude" }
$context = if ($env:CLAUDE_CONTEXT_PCT) { "$($env:CLAUDE_CONTEXT_PCT)%" } else { "--" }
$line = "${dir} | ${model} | ${context}"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
Write-Output $line
