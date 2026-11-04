# Bundles index.html and js/*.js into one self-contained page, "Super Smash Toads.html", written next to
# this source folder. Double-click the result to play in any modern browser (online play needs internet).
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$html = [System.IO.File]::ReadAllText((Join-Path $root 'index.html'))
$names = 'data', 'sim', 'ai', 'audio', 'render', 'g3d', 'models3d', 'stage3d', 'view3d', 'main'
foreach ($n in $names) {
  $tag = "<script src=`"js/$n.js`"></script>"
  if (-not $html.Contains($tag)) { throw "index.html is missing $tag" }
  $js = [System.IO.File]::ReadAllText((Join-Path $root "js\$n.js"))
  if ($js -match '</script') { throw "js/$n.js contains </script and cannot be inlined" }
  $html = $html.Replace($tag, "<script>`n" + $js + "`n</script>")
}
if ($html -match '<script src="js/') { throw 'index.html loads a script the build does not know about' }
$out = Join-Path (Split-Path -Parent $root) 'Super Smash Toads.html'
[System.IO.File]::WriteAllText($out, $html, (New-Object System.Text.UTF8Encoding($false)))
"Built $out ($([Math]::Round((Get-Item $out).Length / 1KB)) KB)"
