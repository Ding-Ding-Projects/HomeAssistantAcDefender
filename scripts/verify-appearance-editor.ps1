$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$requiredMarkers = @{
    'Components/Pages/Settings.razor' = @('Title="Appearance"', 'Apply appearance', 'Reset appearance', 'appearance-font-scale', 'acAppearance.save')
    'Components/Layout/MainLayout.razor' = @('acAppearance.read', 'acAppearance.subscribe', 'OnAppearanceChanged', 'acAppearance.unsubscribe')
    'Services/AppearancePreferences.cs' = @('DefaultTheme', 'AllowedFontFamilies', 'Normalize', 'Math.Clamp(value.FontScale, 0.85, 1.35)')
    'wwwroot/js/appearance.js' = @('ac-defender-appearance', 'localStorage', 'acAppearance', 'theme', 'density', 'fontFamily', 'fontScale', 'reset')
    'wwwroot/css/site.css' = @('--ac-ui-font-family', '--ac-ui-font-scale', 'data-ac-density', 'data-ac-appearance')
    'docs/wiki/Appearance-editor.md' = @('Failure modes', 'Security considerations', 'Verification', 'Suggested articles')
}

foreach ($entry in $requiredMarkers.GetEnumerator()) {
    $path = Join-Path $repoRoot $entry.Key
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Missing appearance-editor file: $($entry.Key)"
    }

    $content = Get-Content -LiteralPath $path -Raw
    foreach ($marker in $entry.Value) {
        if ($content.IndexOf($marker, [StringComparison]::Ordinal) -lt 0) {
            throw "Missing appearance-editor marker '$marker' in $($entry.Key)"
        }
    }
}

Write-Output 'Appearance editor contract: PASS (settings, layout, model, JS, CSS, and docs markers present).'
