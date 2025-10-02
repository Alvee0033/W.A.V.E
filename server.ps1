param(
  [int]$Port = 8000
)

$root = Get-Location
$pub = Join-Path $root 'public'

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Local server running: http://localhost:$Port/"

try {
  while ($true) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $path = $req.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrEmpty($path)) {
      $file = Join-Path $pub 'EARTH.html'
    } else {
      $file = Join-Path $pub $path
    }

    if (-not (Test-Path $file)) {
      $res.StatusCode = 404
      $buf = [Text.Encoding]::UTF8.GetBytes('Not Found')
      $res.OutputStream.Write($buf, 0, $buf.Length)
      $res.OutputStream.Close()
      continue
    }

    switch ([IO.Path]::GetExtension($file).ToLower()) {
      '.html' { $res.ContentType = 'text/html' }
      '.js'   { $res.ContentType = 'application/javascript' }
      '.css'  { $res.ContentType = 'text/css' }
      '.png'  { $res.ContentType = 'image/png' }
      '.jpg'  { $res.ContentType = 'image/jpeg' }
      '.jpeg' { $res.ContentType = 'image/jpeg' }
      '.svg'  { $res.ContentType = 'image/svg+xml' }
      default { $res.ContentType = 'application/octet-stream' }
    }

    $bytes = [IO.File]::ReadAllBytes($file)
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}