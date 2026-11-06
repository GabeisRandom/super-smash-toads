# Bundles index.html and js/*.js into one self-contained page, "Super Smash Toads.html", written next to
# this source folder. Double-click the result to play in any modern browser (online play needs internet).
# Every build also stamps a fresh version mark into index.html (its <meta name="sst-build"> and each script
# link's ?v=) and into js/data.js (GAME_BUILD), so a browser can never mix an old cached file with a new one.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$enc = New-Object System.Text.UTF8Encoding($false)
$stamp = Get-Date -Format 'yyyyMMddHHmm'
$names = 'data', 'sim', 'ai', 'audio', 'render', 'g3d', 'models3d', 'stage3d', 'view3d', 'main'

$ip = Join-Path $root 'index.html'
$html = [System.IO.File]::ReadAllText($ip)
if ($html -notmatch '<meta name="sst-build" content="\w*">') { throw 'index.html is missing <meta name="sst-build">' }
$html = [regex]::Replace($html, '<meta name="sst-build" content="\w*">', "<meta name=`"sst-build`" content=`"$stamp`">")
$html = [regex]::Replace($html, '<script src="js/(\w+)\.js(\?v=\w+)?"></script>', "<script src=`"js/`$1.js?v=$stamp`"></script>")
[System.IO.File]::WriteAllText($ip, $html, $enc)
$dp = Join-Path $root 'js\data.js'
$data = [System.IO.File]::ReadAllText($dp)
if ($data -notmatch "const GAME_BUILD = '\w*';") { throw 'js/data.js is missing GAME_BUILD' }
[System.IO.File]::WriteAllText($dp, [regex]::Replace($data, "const GAME_BUILD = '\w*';", "const GAME_BUILD = '$stamp';"), $enc)

foreach ($n in $names) {
  $tag = "<script src=`"js/$n.js?v=$stamp`"></script>"
  if (-not $html.Contains($tag)) { throw "index.html is missing $tag" }
  $js = [System.IO.File]::ReadAllText((Join-Path $root "js\$n.js"))
  if ($js -match '</script') { throw "js/$n.js contains </script and cannot be inlined" }
  $html = $html.Replace($tag, "<script>`n" + $js + "`n</script>")
}
if ($html -match '<script src="js/') { throw 'index.html loads a script the build does not know about' }
$out = Join-Path (Split-Path -Parent $root) 'Super Smash Toads.html'
[System.IO.File]::WriteAllText($out, $html, $enc)
"Built $out ($([Math]::Round((Get-Item $out).Length / 1KB)) KB), version $stamp"
