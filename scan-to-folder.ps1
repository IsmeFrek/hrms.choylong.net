# scan-to-folder.ps1
# PowerShell helper to scan from a local scanner into the backend scans folder.
# Usage: Run this script in PowerShell (may need to run as administrator or adjust execution policy):
#   powershell -ExecutionPolicy Bypass -File .\scan-to-folder.ps1
# It will open the native WIA scan dialog and save the scanned image as JPG into backend/public/Uploads/scans

$scansDir = Join-Path -Path $PSScriptRoot -ChildPath "backend/public/Uploads/scans"
if (-not (Test-Path $scansDir)) {
    New-Item -ItemType Directory -Path $scansDir -Force | Out-Null
}

Write-Host "Scans will be saved to: $scansDir"

param(
    [string]$Format = 'jpg'
)

try {
    # Use WIA CommonDialog to show the scanner dialog
    $wia = New-Object -ComObject WIA.CommonDialog
    $device = $wia.ShowSelectDevice()
    if (-not $device) { Write-Host "No device selected."; exit }

    # Map requested format to WIA format GUIDs where possible
    $fmt = $Format.ToLower()
    switch ($fmt) {
        'jpg' { $formatGUID = '{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}'; $ext = 'jpg' }
        'jpeg' { $formatGUID = '{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}'; $ext = 'jpg' }
        'png' { $formatGUID = '{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}'; $ext = 'png' }
        'tif' { $formatGUID = '{B96B3CAD-0728-11D3-9D7B-0000F81EF32E}'; $ext = 'tif' }
        'tiff' { $formatGUID = '{B96B3CAD-0728-11D3-9D7B-0000F81EF32E}'; $ext = 'tif' }
        'pdf' { $formatGUID = $null; $ext = 'pdf' }
        default { $formatGUID = '{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}'; $ext = 'jpg' }
    }

    $item = $device.Items.Item(1)

    if ($formatGUID) {
        $file = $wia.ShowTransfer($item, $formatGUID, $false)
        if ($file -ne $null) {
            $timestamp = Get-Date -Format "yyyyMMddHHmmss"
            $outPath = Join-Path $scansDir ("scan-$timestamp.$ext")
            $file.SaveFile($outPath)
            Write-Host "Saved scan to: $outPath"
        } else {
            Write-Host "No file returned from scanner."
        }
    } else {
        # PDF requested: try to use NAPS2 if available to produce PDF output
        $napsCmd = 'naps2.console.exe'
        $napsPath = (Get-Command $napsCmd -ErrorAction SilentlyContinue).Path
        if ($napsPath) {
            $timestamp = Get-Date -Format "yyyyMMddHHmmss"
            $outPath = Join-Path $scansDir ("scan-$timestamp.pdf")
            Write-Host "Using NAPS2 to create PDF: $outPath"
            & $napsCmd -o "$outPath" -f pdf -s 300
            if (Test-Path $outPath) { Write-Host "Saved scan to: $outPath" } else { Write-Host "NAPS2 did not produce output." }
        } else {
            Write-Host "PDF requested but NAPS2 not found. Falling back to JPEG output."
            $file = $wia.ShowTransfer($item, '{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}', $false)
            if ($file -ne $null) {
                $timestamp = Get-Date -Format "yyyyMMddHHmmss"
                $outPath = Join-Path $scansDir ("scan-$timestamp.jpg")
                $file.SaveFile($outPath)
                Write-Host "Saved scan (fallback jpg) to: $outPath"
            } else { Write-Host "No file returned from scanner." }
        }
    }
} catch {
    Write-Error "Scan failed: $_"
    Write-Host "If WIA is not available, consider installing NAPS2 and using its CLI. Example (NAPS2 must be installed):"
    Write-Host "naps2.console.exe -o \"$scansDir\\scan-$(Get-Date -Format 'yyyyMMddHHmmss').pdf\" -f pdf -s 300"
}

Write-Host "Done. You can now use the app 'Import from Scanner' button to import files."