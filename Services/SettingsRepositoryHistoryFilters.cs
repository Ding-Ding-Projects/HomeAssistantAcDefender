using System.Globalization;
using System.Text.RegularExpressions;
using HomeAssistantAcDefender.Models;

namespace HomeAssistantAcDefender.Services;

/// <summary>
/// Pure, bounded filtering for the local settings repository history surface.
/// The journal remains append-only; this helper only classifies and selects the
/// commits that are already present in the local Git history.
/// </summary>
public static class SettingsRepositoryHistoryFilters
{
    public const string Created = "created";
    public const string Updated = "updated";
    public const string Restored = "restored";
    public const string Undone = "undone";

    public static IReadOnlyList<SettingsRepositoryCommit> Filter(
        IEnumerable<SettingsRepositoryCommit> commits,
        string? search,
        string? searchMode,
        string? searchFlags,
        IReadOnlyCollection<string>? actions,
        string? fromDate,
        string? toDate)
    {
        var source = commits ?? [];
        if (!TryGetDateRange(fromDate, toDate, out var fromInclusive, out var toExclusive))
        {
            return [];
        }

        var selectedActions = actions is { Count: > 0 }
            ? new HashSet<string>(actions, StringComparer.OrdinalIgnoreCase)
            : null;

        return source
            .Where(commit => MatchesDate(commit, fromInclusive, toExclusive))
            .Where(commit => selectedActions is null || selectedActions.Contains(ActionFor(commit)))
            .Where(commit => MatchesSearch(commit, search, searchMode, searchFlags))
            .ToArray();
    }

    public static IReadOnlyDictionary<string, int> ActionCounts(
        IEnumerable<SettingsRepositoryCommit> commits,
        string? fromDate,
        string? toDate)
    {
        return Filter(commits, "", "plain", "im", [], fromDate, toDate)
            .GroupBy(ActionFor, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Count(), StringComparer.OrdinalIgnoreCase);
    }

    public static string ActionFor(SettingsRepositoryCommit commit)
    {
        var message = commit.Message.Trim();
        if (message.StartsWith("Revert ", StringComparison.OrdinalIgnoreCase)
            || message.Contains("undo", StringComparison.OrdinalIgnoreCase))
        {
            return Undone;
        }

        if (message.StartsWith("Restore ", StringComparison.OrdinalIgnoreCase)
            || message.Contains("restore", StringComparison.OrdinalIgnoreCase))
        {
            return Restored;
        }

        // The first commit has no parent in Git's own history. This is the only
        // source of truth for a created snapshot; every later ordinary snapshot
        // is an update, regardless of the free-form commit reason.
        return string.IsNullOrWhiteSpace(commit.ParentHash) ? Created : Updated;
    }

    public static IReadOnlyList<string> ActionKinds(
        IEnumerable<SettingsRepositoryCommit> commits,
        string? fromDate,
        string? toDate) => ActionCounts(commits, fromDate, toDate)
        .Keys
        .OrderBy(action => action, StringComparer.OrdinalIgnoreCase)
        .ToArray();

    public static string? DateRangeError(string? fromDate, string? toDate)
    {
        if (!string.IsNullOrWhiteSpace(fromDate) && !TryParseDate(fromDate, out _))
        {
            return "Start date must be a complete YYYY-MM-DD ISO date or a complete local short date.";
        }

        if (!string.IsNullOrWhiteSpace(toDate) && !TryParseDate(toDate, out _))
        {
            return "End date must be a complete YYYY-MM-DD ISO date or a complete local short date.";
        }

        if (TryParseDate(fromDate, out var from) && TryParseDate(toDate, out var to) && to < from)
        {
            return "End date must be on or after the start date.";
        }

        return null;
    }

    public static (string From, string To) ResolvePreset(string? preset, DateOnly today)
    {
        var format = "yyyy-MM-dd";
        return preset?.Trim().ToLowerInvariant() switch
        {
            "today" => (today.ToString(format, CultureInfo.InvariantCulture), today.ToString(format, CultureInfo.InvariantCulture)),
            "7d" => (today.AddDays(-6).ToString(format, CultureInfo.InvariantCulture), today.ToString(format, CultureInfo.InvariantCulture)),
            "30d" => (today.AddDays(-29).ToString(format, CultureInfo.InvariantCulture), today.ToString(format, CultureInfo.InvariantCulture)),
            "90d" => (today.AddDays(-89).ToString(format, CultureInfo.InvariantCulture), today.ToString(format, CultureInfo.InvariantCulture)),
            "month" => (new DateOnly(today.Year, today.Month, 1).ToString(format, CultureInfo.InvariantCulture), today.ToString(format, CultureInfo.InvariantCulture)),
            _ => ("", "")
        };
    }

    public static bool TryParseDate(string? value, out DateOnly date)
    {
        var candidate = value?.Trim() ?? "";
        if (DateOnly.TryParseExact(candidate, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out date))
        {
            return true;
        }

        // Keep the ISO form authoritative while accepting the user's local
        // short date format for typed input (never accept a partial value).
        return DateOnly.TryParse(candidate, CultureInfo.CurrentCulture, DateTimeStyles.AllowWhiteSpaces, out date);
    }

    public static bool TryGetDateRange(
        string? fromDate,
        string? toDate,
        out DateTimeOffset? fromInclusive,
        out DateTimeOffset? toExclusive)
    {
        fromInclusive = null;
        toExclusive = null;
        if (DateRangeError(fromDate, toDate) is not null)
        {
            return false;
        }

        if (TryParseDate(fromDate, out var from))
        {
            fromInclusive = new DateTimeOffset(from.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        }

        if (TryParseDate(toDate, out var to))
        {
            toExclusive = new DateTimeOffset(to.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        }

        return true;
    }

    private static bool MatchesDate(
        SettingsRepositoryCommit commit,
        DateTimeOffset? fromInclusive,
        DateTimeOffset? toExclusive)
    {
        if (fromInclusive is null && toExclusive is null)
        {
            return true;
        }

        if (!DateTimeOffset.TryParse(
                commit.Timestamp,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                out var timestamp))
        {
            return false;
        }

        return (fromInclusive is null || timestamp >= fromInclusive.Value)
            && (toExclusive is null || timestamp < toExclusive.Value);
    }

    private static bool MatchesSearch(
        SettingsRepositoryCommit commit,
        string? search,
        string? searchMode,
        string? searchFlags)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return true;
        }

        var haystack = $"{commit.ShortHash} {commit.Timestamp} {commit.Message} {ActionFor(commit)}";
        if (string.Equals(searchMode, "regex", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var options = RegexOptions.CultureInvariant;
                if ((searchFlags ?? "").Contains('i', StringComparison.OrdinalIgnoreCase)) options |= RegexOptions.IgnoreCase;
                if ((searchFlags ?? "").Contains('m', StringComparison.OrdinalIgnoreCase)) options |= RegexOptions.Multiline;
                if ((searchFlags ?? "").Contains('s', StringComparison.OrdinalIgnoreCase)) options |= RegexOptions.Singleline;
                return new Regex(search, options, TimeSpan.FromMilliseconds(100)).IsMatch(haystack);
            }
            catch (ArgumentException)
            {
                return false;
            }
            catch (RegexMatchTimeoutException)
            {
                return false;
            }
        }

        var terms = search.Split(' ', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        return terms.All(term => haystack.Contains(term, StringComparison.OrdinalIgnoreCase));
    }
}
