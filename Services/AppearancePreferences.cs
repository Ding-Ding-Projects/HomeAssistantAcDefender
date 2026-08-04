namespace HomeAssistantAcDefender.Services;

/// <summary>
/// Browser-scoped presentation preferences. These values style the website shell only;
/// they are deliberately separate from the defender settings sent to Home Assistant.
/// </summary>
public sealed class AppearancePreferences
{
    public const string DefaultTheme = "dark";
    public const string DefaultDensity = "comfortable";
    public const string DefaultAccent = "#3ddc97";
    public const string DefaultFontFamily = "Segoe UI";
    public const double DefaultFontScale = 1.0;

    public string Theme { get; set; } = DefaultTheme;
    public string Density { get; set; } = DefaultDensity;
    public string Accent { get; set; } = DefaultAccent;
    public string FontFamily { get; set; } = DefaultFontFamily;
    public double FontScale { get; set; } = DefaultFontScale;

    public static AppearancePreferences Defaults() => new();

    public static AppearancePreferences Normalize(AppearancePreferences? value)
    {
        value ??= Defaults();

        return new AppearancePreferences
        {
            Theme = value.Theme is "light" or "dark" ? value.Theme : DefaultTheme,
            Density = value.Density is "compact" or "comfortable" or "spacious" ? value.Density : DefaultDensity,
            Accent = IsHexColor(value.Accent) ? value.Accent.ToLowerInvariant() : DefaultAccent,
            FontFamily = AllowedFontFamilies.Contains(value.FontFamily, StringComparer.Ordinal) ? value.FontFamily : DefaultFontFamily,
            FontScale = double.IsFinite(value.FontScale) ? Math.Clamp(value.FontScale, 0.85, 1.35) : DefaultFontScale
        };
    }

    public static IReadOnlyList<string> AllowedFontFamilies { get; } =
    [
        "Segoe UI",
        "Arial",
        "Cascadia Code",
        "Consolas",
        "system-ui"
    ];

    private static bool IsHexColor(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length != 7 || value[0] != '#')
        {
            return false;
        }

        return value[1..].All(Uri.IsHexDigit);
    }
}
