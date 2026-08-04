using HomeAssistantAcDefender.Options;
using HomeAssistantAcDefender.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

internal sealed class NotificationHistoryStoreTests
{
    public void JournalSurvivesRestartAndReviewActions()
    {
        var contentRoot = Path.Combine(Path.GetTempPath(), "ac-defender-notifications-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(contentRoot);
        try
        {
            var options = Options.Create(new DefenderOptions
            {
                StateFilePath = Path.Combine(contentRoot, "state.json"),
            });
            var environment = new TestWebHostEnvironment(contentRoot);
            var first = new NotificationHistoryStore(options, environment, NullLogger<NotificationHistoryStore>.Instance);

            var info = first.Append("NOTICE", "A quiet timing hold is active.", DateTimeOffset.Parse("2026-08-04T12:00:00Z"));
            var warning = first.Append("warning", "The wall thermostat changed; the defender is watching.", DateTimeOffset.Parse("2026-08-04T12:01:00Z"));
            var initial = first.GetSnapshot();
            Assert(initial.Items.Count == 2, "A fresh journal should expose both active notifications.");
            Assert(initial.UnreadCount == 2 && initial.ActiveCount == 2, "Fresh notifications should be unread and active.");

            Assert(first.MarkRead(info.Id), "A known notification should be markable as read.");
            Assert(first.Dismiss(warning.Id), "A known notification should be dismissible.");
            var afterActions = first.GetSnapshot();
            Assert(afterActions.Items.Count == 1 && afterActions.Items[0].Id == info.Id, "Dismissed notifications should leave the active centre by default.");
            Assert(afterActions.UnreadCount == 0 && afterActions.ActiveCount == 1, "Read and dismissed counts should update immediately.");

            // A torn final line must not erase the valid prefix on process restart.
            File.AppendAllText(first.JournalPath, "{ this is not a complete json journal entry" + Environment.NewLine);
            var restarted = new NotificationHistoryStore(options, environment, NullLogger<NotificationHistoryStore>.Instance);
            var all = restarted.GetSnapshot(includeDismissed: true);
            Assert(all.Items.Count == 2, "Restart should replay both valid notifications and ignore only the malformed line.");
            Assert(all.Items.Single(item => item.Id == info.Id).Read, "Read state should be reconstructed from the journal.");
            Assert(all.Items.Single(item => item.Id == warning.Id).Dismissed, "Dismissed state should be reconstructed from the journal.");
            Assert(restarted.GetSnapshot(level: "WARNING").Items.Count == 0, "Dismissed warnings should not appear in the default active level filter.");

            Assert(restarted.Restore(warning.Id), "A dismissed notification should be restorable for review.");
            var restored = restarted.GetSnapshot(level: "warning");
            Assert(restored.Items.Count == 1 && restored.Items[0].Id == warning.Id, "Restoring should return the warning to the active centre.");
            var warningActions = restored.Items[0].Actions ?? [];
            Assert(warningActions.SequenceEqual(["created", "dismissed", "restored"]),
                "The notification record should expose the real journal action history in order.");
        }
        finally
        {
            try
            {
                Directory.Delete(contentRoot, recursive: true);
            }
            catch
            {
                // Test cleanup should not mask the assertion that failed first.
            }
        }
    }

    public void DateAndActionFiltersUseJournalHistory()
    {
        var contentRoot = Path.Combine(Path.GetTempPath(), "ac-defender-notification-filters-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(contentRoot);
        try
        {
            var options = Options.Create(new DefenderOptions { StateFilePath = Path.Combine(contentRoot, "state.json") });
            var environment = new TestWebHostEnvironment(contentRoot);
            var store = new NotificationHistoryStore(options, environment, NullLogger<NotificationHistoryStore>.Instance);
            var before = store.Append("info", "before", DateTimeOffset.Parse("2026-08-03T23:59:59Z"));
            var inside = store.Append("warning", "inside", DateTimeOffset.Parse("2026-08-04T12:00:00Z"));
            var after = store.Append("error", "after", DateTimeOffset.Parse("2026-08-05T00:00:01Z"));
            Assert(store.Dismiss(inside.Id), "The in-range notification should accept a real dismiss action.");

            var filtered = store.GetSnapshot(
                includeDismissed: true,
                fromInclusive: DateTimeOffset.Parse("2026-08-04T00:00:00Z"),
                toExclusive: DateTimeOffset.Parse("2026-08-05T00:00:00Z"),
                actions: new HashSet<string>(["dismissed"], StringComparer.OrdinalIgnoreCase));
            Assert(filtered.Items.Count == 1 && filtered.Items[0].Id == inside.Id,
                "Date bounds and an action filter should select only the matching journal record.");
            Assert(filtered.ActionCounts is not null
                && filtered.ActionCounts.TryGetValue("created", out var created) && created == 1
                && filtered.ActionCounts.TryGetValue("dismissed", out var dismissed) && dismissed == 1,
                "Action counts should be derived from the selected records and not a hard-coded status list.");
            Assert(before.Id != inside.Id && after.Id != inside.Id, "Boundary fixtures should remain distinct real records.");
        }
        finally
        {
            try
            {
                Directory.Delete(contentRoot, recursive: true);
            }
            catch
            {
                // Test cleanup should not mask the assertion that failed first.
            }
        }
    }

    private static void Assert(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
