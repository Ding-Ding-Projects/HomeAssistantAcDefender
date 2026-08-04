using System.Text.RegularExpressions;

namespace HomeAssistantAcDefender.Services;

/// <summary>
/// Bounded local matching shared by user-facing search surfaces that expose the full
/// <see cref="Components.Shared.RegexSearchBuilder"/>. Plain text remains the default;
/// regex evaluation is opt-in and time-limited so a search cannot stall the Blazor circuit.
/// </summary>
public static class RegexSearchMatcher
{
    public const int MaxPatternLength = 512;
    public const int MaxValueLength = 16_384;
    public static readonly TimeSpan RegexTimeout = TimeSpan.FromMilliseconds(100);

    public static bool Matches(string? query, string? mode, string? flags, params string?[] values)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return true;
        }

        var candidates = values
            .Where(value => !string.IsNullOrEmpty(value))
            .Select(value => value!.Length > MaxValueLength ? value[..MaxValueLength] : value)
            .ToArray();

        if (!string.Equals(mode, "regex", StringComparison.OrdinalIgnoreCase))
        {
            var terms = query.Split(' ', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            return terms.Length == 0
                || terms.All(term => candidates.Any(value => value.Contains(term, StringComparison.OrdinalIgnoreCase)));
        }

        if (query.Length > MaxPatternLength || !TryBuild(query, flags, out var regex))
        {
            return false;
        }

        foreach (var value in candidates)
        {
            try
            {
                if (regex!.IsMatch(value))
                {
                    return true;
                }
            }
            catch (RegexMatchTimeoutException)
            {
                return false;
            }
        }

        return false;
    }

    public static bool TryBuild(string pattern, string? flags, out Regex? regex)
    {
        regex = null;
        if (string.IsNullOrWhiteSpace(pattern) || pattern.Length > MaxPatternLength)
        {
            return false;
        }

        try
        {
            var options = RegexOptions.CultureInvariant;
            var normalizedFlags = flags ?? string.Empty;
            if (normalizedFlags.Contains('i')) options |= RegexOptions.IgnoreCase;
            if (normalizedFlags.Contains('m')) options |= RegexOptions.Multiline;
            if (normalizedFlags.Contains('s')) options |= RegexOptions.Singleline;
            regex = new Regex(pattern, options, RegexTimeout);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }
}
