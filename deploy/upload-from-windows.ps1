# Upload deploy folder to EC2 when git pull is not available
# Usage (PowerShell on Windows):
#   .\deploy\upload-from-windows.ps1 -Ec2Ip YOUR_EC2_PUBLIC_IP

param(
    [Parameter(Mandatory = $true)]
    [string]$Ec2Ip,

    [string]$KeyPath = "$env:USERPROFILE\Downloads\opsrelay.pem",
    [string]$RemoteDir = "/home/ubuntu/OPSRELAYDashboard"
)

$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Uploading deploy/ to ubuntu@${Ec2Ip}:${RemoteDir}/deploy/" -ForegroundColor Cyan

scp -i $KeyPath -r "$ProjectRoot\deploy" "ubuntu@${Ec2Ip}:${RemoteDir}/"

Write-Host ""
Write-Host "Done. On EC2 run:" -ForegroundColor Green
Write-Host "  cd $RemoteDir"
Write-Host "  bash deploy/setup-nginx.sh"
Write-Host "  bash deploy/health-check.sh"
