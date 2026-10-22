# Unpack selected Cocos atlas frames using Windows' built-in image library.
Add-Type -AssemblyName System.Drawing
$assetRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../original-ludo/king'))
$frames = Get-Content -LiteralPath (Join-Path $assetRoot 'frames.json') -Raw | ConvertFrom-Json
foreach ($property in $frames.PSObject.Properties) {
    $frame = $property.Value
    $image = [Drawing.Bitmap]::FromFile((Join-Path $assetRoot $frame.texture))
    try {
        $width = [int]$frame.rect[2]
        $height = [int]$frame.rect[3]
        if ($frame.rotated) { $cropWidth = $height; $cropHeight = $width }
        else { $cropWidth = $width; $cropHeight = $height }
        $rect = [Drawing.Rectangle]::new([int]$frame.rect[0], [int]$frame.rect[1], $cropWidth, $cropHeight)
        $tile = $image.Clone($rect, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            if ($frame.rotated) { $tile.RotateFlip([Drawing.RotateFlipType]::Rotate270FlipNone) }
            $tile.Save((Join-Path $assetRoot ($property.Name + '.png')), [Drawing.Imaging.ImageFormat]::Png)
        } finally { $tile.Dispose() }
    } finally { $image.Dispose() }
}
Write-Output 'Extracted King menu and game-start frames.'
