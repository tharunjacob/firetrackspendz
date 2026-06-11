$files = Get-ChildItem -Path src -Recurse -Include "*.ts","*.tsx"
$totalLines = 0
$results = @()
foreach ($f in $files) {
    $lines = (Get-Content $f.FullName | Measure-Object -Line).Lines
    $totalLines += $lines
    $results += [PSCustomObject]@{ Name=$f.Name; Lines=$lines; Bytes=$f.Length }
}
$topFiles = $results | Sort-Object Lines -Descending | Select-Object -First 15
$topFiles | Format-Table -AutoSize
Write-Host ""
Write-Host "=== TOTALS ==="
Write-Host "Total .ts/.tsx files : $($files.Count)"
Write-Host "Total lines of code  : $totalLines"

# Also count CSS
$cssFiles = Get-ChildItem -Path src -Recurse -Include "*.css"
$cssLines = 0
foreach ($f in $cssFiles) { $cssLines += (Get-Content $f.FullName | Measure-Object -Line).Lines }
Write-Host "Total .css files     : $($cssFiles.Count)"
Write-Host "Total CSS lines      : $cssLines"
Write-Host "GRAND TOTAL lines    : $($totalLines + $cssLines)"

# Byte totals (raw size = rough token estimate)
$totalBytes = ($files | Measure-Object -Property Length -Sum).Sum + ($cssFiles | Measure-Object -Property Length -Sum).Sum
Write-Host "Total source bytes   : $totalBytes"
Write-Host "Approx tokens (~3.5 chars/token): $([math]::Round($totalBytes / 3.5 / 1000))K"
