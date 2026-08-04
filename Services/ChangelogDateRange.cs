using System.Globalization;

namespace HomeAssistantAcDefender.Services;

public enum ChangelogDateInputState
{
    Empty,
    Partial,
    Valid,
    Invalid,
}

public enum ChangelogDatePreset
{
    Today,
    SevenDays,
    ThirtyDays,
}

/// <summary>
/// Pure date-range rules shared by the in-app changelog calendar and its regression tests.
/// Dates are deliberately ISO-only so exports, URLs, and copied filters remain unambiguous.
/// </summary>
public static class ChangelogDateRange
{
    public const string IsoFormat = "yyyy-MM-dd";

    public static ChangelogDateInputState Classify(string? value, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return ChangelogDateInputState.Empty;
        }

        if (value.Length < IsoFormat.Length)
        {
            return ChangelogDateInputState.Partial;
        }

        return DateOnly.TryParseExact(
            value,
            IsoFormat,
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out date)
            ? ChangelogDateInputState.Valid
            : ChangelogDateInputState.Invalid;
    }

    public static (DateOnly? From, DateOnly? To) Preset(DateOnly today, ChangelogDatePreset preset)
        => preset switch
        {
            ChangelogDatePreset.Today => (today, today),
            // A seven-day window includes today and the six preceding calendar days.
            ChangelogDatePreset.SevenDays => (today.AddDays(-6), today),
            // A thirty-day window includes today and the twenty-nine preceding days.
            ChangelogDatePreset.ThirtyDays => (today.AddDays(-29), today),
            _ => (null, null),
        };

    public static (DateOnly? From, DateOnly? To) SelectDate(
        DateOnly? from,
        DateOnly? to,
        DateOnly selected)
    {
        if (from is null || to is not null)
        {
            return (selected, null);
        }

        return selected < from.Value
            ? (selected, from)
            : (from, selected);
    }

    public static IReadOnlyList<DateOnly> CalendarDays(DateOnly month)
    {
        var first = new DateOnly(month.Year, month.Month, 1);
        var mondayOffset = ((int)first.DayOfWeek + 6) % 7;
        var start = first.AddDays(-mondayOffset);
        return Enumerable.Range(0, 42)
            .Select(index => start.AddDays(index))
            .ToArray();
    }

    public static DateOnly MonthStart(DateOnly value) => new(value.Year, value.Month, 1);

    public static DateOnly ShiftMonth(DateOnly value, int months)
        => MonthStart(value).AddMonths(months);
}
