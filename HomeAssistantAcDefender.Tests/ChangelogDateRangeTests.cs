using HomeAssistantAcDefender.Services;

internal sealed class ChangelogDateRangeTests
{
    public void IsoInputDistinguishesEmptyPartialValidAndInvalid()
    {
        if (ChangelogDateRange.Classify("", out _) != ChangelogDateInputState.Empty
            || ChangelogDateRange.Classify("2026-08", out _) != ChangelogDateInputState.Partial
            || ChangelogDateRange.Classify("2026-08-04", out var valid) != ChangelogDateInputState.Valid
            || valid != new DateOnly(2026, 8, 4)
            || ChangelogDateRange.Classify("2026-02-30", out _) != ChangelogDateInputState.Invalid)
        {
            throw new InvalidOperationException("Changelog date input must preserve empty, partial, valid, and invalid ISO states.");
        }
    }

    public void PresetsAreInclusiveAndUseUtcCalendarDates()
    {
        var today = new DateOnly(2026, 8, 4);
        var seven = ChangelogDateRange.Preset(today, ChangelogDatePreset.SevenDays);
        var thirty = ChangelogDateRange.Preset(today, ChangelogDatePreset.ThirtyDays);
        if (seven != (new DateOnly(2026, 7, 29), today)
            || thirty != (new DateOnly(2026, 7, 6), today)
            || ChangelogDateRange.Preset(today, ChangelogDatePreset.Today) != (today, today))
        {
            throw new InvalidOperationException("Changelog date presets must include today and the requested number of calendar days.");
        }
    }

    public void CalendarSelectionBuildsAndRestartsRanges()
    {
        var first = ChangelogDateRange.SelectDate(null, null, new DateOnly(2026, 8, 4));
        var complete = ChangelogDateRange.SelectDate(first.From, first.To, new DateOnly(2026, 8, 8));
        var reversed = ChangelogDateRange.SelectDate(complete.From, complete.To, new DateOnly(2026, 8, 1));
        if (first != (new DateOnly(2026, 8, 4), null)
            || complete != (new DateOnly(2026, 8, 4), new DateOnly(2026, 8, 8))
            || reversed != (new DateOnly(2026, 8, 1), null))
        {
            throw new InvalidOperationException("Calendar range selection must order a range and restart after a completed range.");
        }
    }

    public void CalendarGridIsSixWeeksAndMondayFirst()
    {
        var days = ChangelogDateRange.CalendarDays(new DateOnly(2026, 8, 15));
        if (days.Count != 42 || days[0] != new DateOnly(2026, 7, 27) || days[^1] != new DateOnly(2026, 9, 6))
        {
            throw new InvalidOperationException("Calendar grid must provide a stable six-week Monday-first range.");
        }
    }
}
