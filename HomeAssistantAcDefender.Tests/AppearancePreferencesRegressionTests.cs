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

    public void ColorTranslatorConvertsHexRgbHslAndAlpha()
    {
        var source = new AppearanceRgba(61, 220, 151, 0.42);
        var hex = AppearanceColor.ToHex(source, includeAlpha: true);
        AssertEqual("#3ddc976b", hex, "HEX8 output must preserve RGB and rounded alpha.");
        if (!AppearanceColor.TryParseHex(hex, out var parsed))
        {
            throw new InvalidOperationException("HEX8 values must parse.");
        }

        AssertEqual(source.Red, parsed.Red, "HEX round-trip must preserve red.");
        AssertEqual(source.Green, parsed.Green, "HEX round-trip must preserve green.");
        AssertEqual(source.Blue, parsed.Blue, "HEX round-trip must preserve blue.");
        AssertNear(source.Alpha, parsed.Alpha, 0.01, "HEX8 round-trip must preserve alpha.");

        var hsl = AppearanceColor.ToHsl(source);
        var roundTrip = AppearanceColor.FromHsl(hsl.Hue, hsl.Saturation, hsl.Lightness, source.Alpha);
        AssertNear(source.Red, roundTrip.Red, 1, "HSL round-trip must preserve red.");
        AssertNear(source.Green, roundTrip.Green, 1, "HSL round-trip must preserve green.");
        AssertNear(source.Blue, roundTrip.Blue, 1, "HSL round-trip must preserve blue.");
    }

    public void ElementAccentsAreAllowListedAndContrastIsDeterministic()
    {
        var normalized = AppearancePreferences.Normalize(new AppearancePreferences
        {
            AccentAlpha = 99,
            ElementAccents = new Dictionary<string, string>
            {
                ["header"] = "#AABBCC",
                ["rail"] = "url(javascript:nope)",
                ["unknown"] = "#ffffff"
            }
        });

        AssertEqual(1d, normalized.AccentAlpha, "Accent alpha must stay between zero and one.");
        AssertEqual("#aabbcc", normalized.ElementAccents["header"], "Allow-listed element colours should canonicalize.");
        if (normalized.ElementAccents.ContainsKey("rail") || normalized.ElementAccents.ContainsKey("unknown"))
        {
            throw new InvalidOperationException("Invalid or unknown element accents must be discarded.");
        }

        var ratio = AppearanceColor.ContrastRatio("#ffffff", "#000000");
        AssertNear(21d, ratio, 0.01, "White on black should report the WCAG maximum contrast ratio.");
    }

    private static void AssertEqual<T>(T expected, T actual, string message)
    {
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
        {
            throw new InvalidOperationException(message);
        }
    }

    private static void AssertNear(double expected, double actual, double tolerance, string message)
    {
        if (Math.Abs(expected - actual) > tolerance)
        {
            throw new InvalidOperationException($"{message} Expected {expected}, got {actual}.");
        }
    }
}
