Add-Type -AssemblyName System.Drawing

function Generate-TerraPulseIcon([int]$size, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Dark Forest / Emerald Gradient Background with rounded rect
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(0, 0)),
        (New-Object System.Drawing.PointF($size, $size)),
        [System.Drawing.Color]::FromArgb(255, 15, 34, 25),   # Deep Pine
        [System.Drawing.Color]::FromArgb(255, 36, 72, 55)    # Emerald Moss
    )
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)
    $bgBrush.Dispose()

    # Outer Pulse Ring (Eco Sentinel Radar Ring)
    $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(90, 58, 125, 92), [Math]::Max(1.0, $size * 0.04))
    $ringMargin = $size * 0.12
    $g.DrawEllipse($ringPen, $ringMargin, $ringMargin, ($size - 2 * $ringMargin), ($size - 2 * $ringMargin))
    $ringPen.Dispose()

    # Second Inner Cyan/Water Pulse Ring
    $cyanPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 56, 189, 248), [Math]::Max(1.0, $size * 0.03))
    $cyanMargin = $size * 0.22
    $g.DrawEllipse($cyanPen, $cyanMargin, $cyanMargin, ($size - 2 * $cyanMargin), ($size - 2 * $cyanMargin))
    $cyanPen.Dispose()

    # Central Terra Globe / Leaf Drop (Earth + Clean Atmosphere Shield)
    $centerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(($size * 0.3), ($size * 0.25))),
        (New-Object System.Drawing.PointF(($size * 0.7), ($size * 0.75))),
        [System.Drawing.Color]::FromArgb(255, 52, 211, 153),  # Emerald Leaf
        [System.Drawing.Color]::FromArgb(255, 14, 165, 233)   # Clean Water / Air Blue
    )
    $coreMargin = $size * 0.31
    $g.FillEllipse($centerBrush, $coreMargin, $coreMargin, ($size - 2 * $coreMargin), ($size - 2 * $coreMargin))
    $centerBrush.Dispose()

    # Pure White Inner Spark / Vital Pulse Core
    $sparkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $sparkMargin = $size * 0.42
    $g.FillEllipse($sparkBrush, $sparkMargin, $sparkMargin, ($size - 2 * $sparkMargin), ($size - 2 * $sparkMargin))
    $sparkBrush.Dispose()

    # Save PNG
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $outPath ($size x $size)"
}

$sizes = @(32, 72, 96, 128, 144, 152, 180, 192, 384, 512)
$dir = "c:\Users\yash1\Downloads\Terra-Pulse\public\icons"

foreach ($s in $sizes) {
    if ($s -eq 32) {
        Generate-TerraPulseIcon $s "$dir\favicon-32x32.png"
    } elseif ($s -eq 180) {
        Generate-TerraPulseIcon $s "$dir\apple-touch-icon.png"
    } else {
        Generate-TerraPulseIcon $s "$dir\icon-$s`x$s.png"
    }
}
# Also generate root favicon
Generate-TerraPulseIcon 32 "c:\Users\yash1\Downloads\Terra-Pulse\public\favicon.ico"
Write-Host "All TerraPulse icons created successfully!"
