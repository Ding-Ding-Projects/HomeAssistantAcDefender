using System.Globalization;

namespace HomeAssistantAcDefender.Services;

/// <summary>
/// Small, dependency-free colour translator used by the appearance editor. Values stay
/// local to the browser; this type only makes the editor's HEX/RGB/HSL/contrast facts
/// deterministic and testable instead of relying on browser-specific picker behaviour.
/// </summary>
public readonly record struct AppearanceRgba(byte Red, byte Green, byte Blue, double Alpha = 1)
{
    public double ClampedAlpha => double.IsFinite(Alpha) ? Math.Clamp(Alpha, 0, 1) : 1;
}

public readonly record struct AppearanceHsl(double Hue, double Saturation, double Lightness);

public static class AppearanceColor
{
    public static bool TryParseHex(string? value, out AppearanceRgba color)
    {
        color = default;
        if (string.IsNullOrWhiteSpace(value) || (value.Length != 7 && value.Length != 9) || value[0] != '#')
        {
            return false;
        }

        if (!byte.TryParse(value[1..3], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var red) ||
            !byte.TryParse(value[3..5], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var green) ||
            !byte.TryParse(value[5..7], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var blue))
        {
            return false;
        }

        var alpha = 1d;
        if (value.Length == 9)
        {
            if (!byte.TryParse(value[7..9], NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var alphaByte))
            {
                return false;
            }

            alpha = alphaByte / 255d;
        }

        color = new AppearanceRgba(red, green, blue, alpha);
        return true;
    }

    public static string ToHex(AppearanceRgba color, bool includeAlpha = false)
    {
        var baseHex = $"#{color.Red:X2}{color.Green:X2}{color.Blue:X2}".ToLowerInvariant();
        return includeAlpha ? $"{baseHex}{(byte)Math.Round(color.ClampedAlpha * 255, MidpointRounding.AwayFromZero):x2}" : baseHex;
    }

    public static AppearanceHsl ToHsl(AppearanceRgba color)
    {
        var red = color.Red / 255d;
        var green = color.Green / 255d;
        var blue = color.Blue / 255d;
        var max = Math.Max(red, Math.Max(green, blue));
        var min = Math.Min(red, Math.Min(green, blue));
        var lightness = (max + min) / 2;
        if (Math.Abs(max - min) < double.Epsilon)
        {
            return new AppearanceHsl(0, 0, lightness * 100);
        }

        var delta = max - min;
        var saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        var hue = max == red
            ? (green - blue) / delta + (green < blue ? 6 : 0)
            : max == green
                ? (blue - red) / delta + 2
                : (red - green) / delta + 4;
        return new AppearanceHsl(hue / 6 * 360, saturation * 100, lightness * 100);
    }

    public static AppearanceRgba FromHsl(double hue, double saturation, double lightness, double alpha = 1)
    {
        hue = ((double.IsFinite(hue) ? hue : 0) % 360 + 360) % 360 / 360;
        saturation = Math.Clamp(double.IsFinite(saturation) ? saturation : 0, 0, 100) / 100;
        lightness = Math.Clamp(double.IsFinite(lightness) ? lightness : 0, 0, 100) / 100;
        if (saturation <= double.Epsilon)
        {
            var gray = (byte)Math.Round(lightness * 255, MidpointRounding.AwayFromZero);
            return new AppearanceRgba(gray, gray, gray, alpha);
        }

        var q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
        var p = 2 * lightness - q;
        var red = HueToRgb(p, q, hue + 1d / 3);
        var green = HueToRgb(p, q, hue);
        var blue = HueToRgb(p, q, hue - 1d / 3);
        return new AppearanceRgba(ToByte(red * 255), ToByte(green * 255), ToByte(blue * 255), alpha);
    }

    public static double ContrastRatio(AppearanceRgba foreground, AppearanceRgba background)
    {
        var foregroundLuminance = RelativeLuminance(foreground);
        var backgroundLuminance = RelativeLuminance(background);
        var lighter = Math.Max(foregroundLuminance, backgroundLuminance);
        var darker = Math.Min(foregroundLuminance, backgroundLuminance);
        return (lighter + 0.05) / (darker + 0.05);
    }

    public static double ContrastRatio(string foregroundHex, string backgroundHex)
    {
        return TryParseHex(foregroundHex, out var foreground) && TryParseHex(backgroundHex, out var background)
            ? ContrastRatio(foreground, background)
            : 1;
    }

    public static string RgbText(AppearanceRgba color) => $"rgb({color.Red}, {color.Green}, {color.Blue})";

    public static string HslText(AppearanceRgba color)
    {
        var hsl = ToHsl(color);
        return $"hsl({hsl.Hue:0.#}, {hsl.Saturation:0.#}%, {hsl.Lightness:0.#}%)";
    }

    private static double RelativeLuminance(AppearanceRgba color)
    {
        static double Channel(byte value)
        {
            var srgb = value / 255d;
            return srgb <= 0.03928 ? srgb / 12.92 : Math.Pow((srgb + 0.055) / 1.055, 2.4);
        }

        return 0.2126 * Channel(color.Red) + 0.7152 * Channel(color.Green) + 0.0722 * Channel(color.Blue);
    }

    private static double HueToRgb(double p, double q, double hue)
    {
        if (hue < 0) hue += 1;
        if (hue > 1) hue -= 1;
        if (hue < 1d / 6) return p + (q - p) * 6 * hue;
        if (hue < 1d / 2) return q;
        if (hue < 2d / 3) return p + (q - p) * (2d / 3 - hue) * 6;
        return p;
    }

    private static byte ToByte(double value) => (byte)Math.Clamp(Math.Round(value, MidpointRounding.AwayFromZero), 0, 255);
}
