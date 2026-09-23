param([ValidateSet('protect', 'unprotect')][string]$Mode)
$ErrorActionPreference = 'Stop'
[Console]::Error.WriteLine('DSH_SECRET_STAGE:init')
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Security
[Console]::Error.WriteLine('DSH_SECRET_STAGE:input')
$secretInput = [Console]::In.ReadToEnd()
[Console]::Error.WriteLine('DSH_SECRET_STAGE:crypt')
try {
  if ($Mode -eq 'protect') {
    $secretBytes = [Text.Encoding]::UTF8.GetBytes($secretInput)
    $protectedBytes = [Security.Cryptography.ProtectedData]::Protect($secretBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Console]::Out.Write([Convert]::ToBase64String($protectedBytes))
  } else {
    $protectedBytes = [Convert]::FromBase64String($secretInput)
    $secretBytes = [Security.Cryptography.ProtectedData]::Unprotect($protectedBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    [Console]::Out.Write([Text.Encoding]::UTF8.GetString($secretBytes))
  }
} catch { exit 1 }
finally { if ($secretBytes) { [Array]::Clear($secretBytes, 0, $secretBytes.Length) } }
[Console]::Error.WriteLine('DSH_SECRET_STAGE:done')
