param([string]$Image = 'kido-backend:startup-check')
# Windows PowerShell treats native stderr (including docker logs) as error records.
# Check native exit codes explicitly; allow captured diagnostic output through.
$ErrorActionPreference = 'Continue'
$testPrefix = 'kido-startup-test-' + [guid]::NewGuid().ToString('N').Substring(0, 10)
$testNetwork = $testPrefix + '-net'
$testDb = $testPrefix + '-db'
$testStorage = $testPrefix + '-storage'
$testApi = $testPrefix + '-api'
$testFailure = $testPrefix + '-failure'

function Invoke-Docker {
    param([string[]]$DockerArgs)
    $result = & docker @DockerArgs
    if ($LASTEXITCODE -ne 0) { throw "Docker command failed: $($DockerArgs[0])" }
    return $result
}

function Get-AppArgs {
    param([hashtable]$Overrides = @{})
    $settings = @{
        NODE_ENV = 'production'; PORT = '4000'; DB_HOST = $testDb; DB_PORT = '5432'
        DB_NAME = 'kido'; DB_USER = 'postgres'; DB_PASSWORD = 'smoke-db-password'
        ADMIN_API_KEY = 'smoke-admin-key'; MINIO_ENDPOINT = $testStorage; MINIO_PORT = '9000'
        MINIO_ACCESS_KEY = 'smoke-storage-admin'; MINIO_SECRET_KEY = 'smoke-storage-password'
        MINIO_BUCKET = 'videos'; MINIO_USE_SSL = 'false'; MINIO_PUBLIC_URL = "http://${testStorage}:9000"
    }
    foreach ($key in $Overrides.Keys) { $settings[$key] = $Overrides[$key] }
    $dockerArgs = @('--network', $testNetwork)
    foreach ($key in $settings.Keys) { $dockerArgs += @('-e', "$key=$($settings[$key])") }
    return $dockerArgs
}

function Wait-App {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        $logs = (Invoke-Docker -DockerArgs @('logs', $testApi) 2>&1) -join "`n"
        if ($logs.Contains('[HTTP] Listening')) { return }
        $running = Invoke-Docker -DockerArgs @('inspect', '--format', '{{.State.Running}}', $testApi)
        if ($running -ne 'true') { throw "Backend exited: $logs" }
        Start-Sleep -Seconds 1
    }
    throw 'Backend startup timed out'
}

function Assert-Failure {
    param([hashtable]$Overrides, [string]$Expected, [string]$Name)
    $runArgs = @('run', '-d', '--name', $testFailure) + (Get-AppArgs -Overrides $Overrides) + @($Image)
    Invoke-Docker -DockerArgs $runArgs | Out-Null
    try {
        $exitCode = Invoke-Docker -DockerArgs @('wait', $testFailure)
        $logs = (Invoke-Docker -DockerArgs @('logs', $testFailure) 2>&1) -join "`n"
        if ($exitCode -ne '1' -or !$logs.Contains($Expected) -or $logs.Contains('[HTTP] Listening')) {
            throw "Unexpected $Name result: exit=$exitCode logs=$logs"
        }
        foreach ($secret in @('smoke-db-password', 'smoke-admin-key', 'smoke-storage-password', 'wrong-smoke-password')) {
            if ($logs.Contains($secret)) { throw 'Secret appeared in logs' }
        }
        Write-Output "PASS: $Name exits with sanitized diagnostic logs"
    } finally {
        Invoke-Docker -DockerArgs @('rm', '-f', '-v', $testFailure) | Out-Null
    }
}

try {
    Invoke-Docker -DockerArgs @('network', 'create', $testNetwork) | Out-Null
    Invoke-Docker -DockerArgs @('run', '-d', '--name', $testDb, '--network', $testNetwork,
        '-e', 'POSTGRES_DB=kido', '-e', 'POSTGRES_PASSWORD=smoke-db-password', 'postgres:16-alpine') | Out-Null
    $dbReady = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        & docker exec $testDb pg_isready -U postgres -d kido *> $null
        if ($LASTEXITCODE -eq 0) { $dbReady = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$dbReady) { throw 'Temporary database did not start' }

    Invoke-Docker -DockerArgs (@('run', '-d', '--name', $testApi) + (Get-AppArgs) + @($Image)) | Out-Null
    # Verify an actual failed MinIO attempt before starting storage.
    $sawFailure = $false
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        $logs = (Invoke-Docker -DockerArgs @('logs', $testApi) 2>&1) -join "`n"
        if ($logs.Contains('[MinIO] Connection attempt')) { $sawFailure = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$sawFailure) { throw 'Did not observe MinIO retry before storage startup' }
    Invoke-Docker -DockerArgs @('run', '-d', '--name', $testStorage, '--network', $testNetwork,
        '-e', 'MINIO_ROOT_USER=smoke-storage-admin', '-e', 'MINIO_ROOT_PASSWORD=smoke-storage-password',
        'quay.io/minio/minio:latest', 'server', '/data', '--console-address', ':9001') | Out-Null
    Wait-App
    Write-Output 'PASS: startup recovers when MinIO becomes available'
    Invoke-Docker -DockerArgs @('exec', $testApi, 'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'lavfi', '-i', 'color=c=blue:s=160x120:r=10', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo',
        '-t', '2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '/tmp/smoke.mp4') | Out-Null
    $uploadScript = @'
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const health = await (await fetch('http://127.0.0.1:4000/api/health')).json();
  assert.equal(health.data.status, 'ok');
  const form = new FormData();
  for (const [k,v] of Object.entries({title:'Smoke video',description:'Docker integration test',category:'science',language:'en',minAge:'3',maxAge:'10',creator:'Smoke test',tags:'[]'})) form.set(k,v);
  form.set('video', new Blob([fs.readFileSync('/tmp/smoke.mp4')], {type:'video/mp4'}), 'smoke.mp4');
  const response = await fetch('http://127.0.0.1:4000/api/admin/videos', {method:'POST', headers:{'X-Admin-Key':process.env.ADMIN_API_KEY}, body:form});
  const result = await response.json();
  assert.equal(response.status, 201, JSON.stringify(result));
  const playlist = await fetch(result.data.videoUrl);
  assert.equal(playlist.status, 200);
  const text = await playlist.text();
  assert.ok(text.includes('#EXTM3U'));
  const segment = text.split(/\r?\n/).find(line => line && !line.startsWith('#'));
  assert.equal((await fetch(new URL(segment, result.data.videoUrl))).status, 200);
  console.log('PASS: health, authenticated upload, public playlist and segment access');
})().catch(error => { console.error(error); process.exit(1); });
'@
    $uploadScript | & docker exec -i $testApi node
    if ($LASTEXITCODE -ne 0) { throw 'Upload test failed' }
    $verifyScript = @'
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
(async () => {
  const result = await (await fetch('http://127.0.0.1:4000/api/videos')).json();
  const video = result.data.find(v => v.title === 'Smoke video');
  assert.ok(video);
  execFileSync('ffmpeg', ['-v','error','-i',video.videoUrl,'-f','null','-'], {timeout:15000});
  console.log('PASS: catalog persistence and HLS audio/video decoding');
})().catch(error => { console.error(error); process.exit(1); });
'@
    Invoke-Docker -DockerArgs @('rm', '-f', '-v', $testApi) | Out-Null
    Invoke-Docker -DockerArgs (@('run', '-d', '--name', $testApi) + (Get-AppArgs) + @($Image)) | Out-Null
    Wait-App
    $verifyScript | & docker exec -i $testApi node
    if ($LASTEXITCODE -ne 0) { throw 'Persistence/playback test failed' }

    Assert-Failure -Overrides @{ MINIO_SECRET_KEY = '' } -Expected 'MINIO_SECRET_KEY' -Name 'Missing MinIO secret'
    Assert-Failure -Overrides @{ DB_PASSWORD = 'wrong-smoke-password' } -Expected 'Connection attempt 5/5 failed' -Name 'Incorrect PostgreSQL credentials'
    Assert-Failure -Overrides @{ MINIO_SECRET_KEY = 'wrong-smoke-password' } -Expected 'Connection attempt 5/5 failed' -Name 'Incorrect MinIO credentials'
    Assert-Failure -Overrides @{ DB_HOST = 'unreachable-smoke-db' } -Expected 'Connection attempt 5/5 failed' -Name 'Unreachable PostgreSQL'
} finally {
    # Only remove unique resources created by this invocation; no host paths are deleted.
    foreach ($container in @($testFailure, $testApi, $testStorage, $testDb)) {
        & docker container inspect $container *> $null
        if ($LASTEXITCODE -eq 0) { & docker rm -f -v $container | Out-Null }
    }
    & docker network inspect $testNetwork *> $null
    if ($LASTEXITCODE -eq 0) { & docker network rm $testNetwork | Out-Null }
}
