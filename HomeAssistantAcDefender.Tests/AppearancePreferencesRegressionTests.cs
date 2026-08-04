using HomeAssistantAcDefender.Services;

internal sealed class AppearancePreferencesRegressionTests
{
    public void NormalizesAndBoundsBrowserPresentationValues()
    {
        var normalized = AppearancePreferences.Normalize(new AppearancePreferences
        {
            Theme = "paper",
            Density = "giant",
            Accent = "url(javascript:bad)",
            FontFamily = "Not Installed",
            FontScale = 99
        });

        AssertEqual(AppearancePreferences.DefaultTheme, normalized.Theme, "Unknown themes must return to the dark default.");
        AssertEqual(AppearancePreferences.DefaultDensity, normalized.Density, "Unknown densities must return to the comfortable default.");
        AssertEqual(AppearancePreferences.DefaultAccent, normalized.Accent, "Non-HEX accents must never reach CSS.");
        AssertEqual(AppearancePreferences.DefaultFontFamily, normalized.FontFamily, "Unknown font families must use the CJK-safe default stack.");
        AssertEqual(1.35, normalized.FontScale, "Font scale must be bounded to the documented maximum.");
    }

    public void PreservesAllowedValuesAndLowercasesAccent()
    {
        var normalized = AppearancePreferences.Normalize(new AppearancePreferences
        {
            Theme = "light",
            Density = "compact",
            Accent = "#AABBCC",
            FontFamily = "Consolas",
            FontScale = 0.85
        });

        AssertEqual("light", normalized.Theme, "Light theme should remain selectable.");
        AssertEqual("compact", normalized.Density, "Compact density should remain selectable.");
        AssertEqual("#aabbcc", normalized.Accent, "Valid accents should be canonicalized without changing their color.");
        AssertEqual("Consolas", normalized.FontFamily, "Allowed font families should remain selectable.");
        AssertEqual(0.85, normalized.FontScale, "Font scale must preserve the documented minimum.");
    }

    private static void AssertEqual<T>(T expected, T actual, string message)
    {
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
        {
            throw new InvalidOperationException(message);
        }
    }
}
