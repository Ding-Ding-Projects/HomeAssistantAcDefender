using HomeAssistantAcDefender.Components.Shared;
using HomeAssistantAcDefender.Services;
using Microsoft.AspNetCore.Components;
using Microsoft.Extensions.Options;
using MudBlazor;
using MudBlazor.Services;

internal sealed class ThermostatCommandFeedbackTests
{
    public void RejectionBackoffUsesOnePersistentViewportSafeOutcome()
    {
        var retry = new ThermostatCommandRetryDeferredException(
            "A test command was rejected.",
            DateTimeOffset.UtcNow.AddSeconds(30),
            ThermostatCommandDeferralReason.RejectedBackoff);
        if (!ThermostatCommandFeedback.IsRejectedBackoff(retry)
            || !ThermostatCommandFeedback.RejectionSnackbarMessage.Contains("Automatic retries are paused", StringComparison.Ordinal)
            || !ThermostatCommandFeedback.RejectionSnackbarMessage.Contains("Notifications", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Rejected retry backoff must map to one actionable thermostat rejection outcome.");
        }

        var root = FindRepositoryRoot();
        var program = File.ReadAllText(Path.Combine(root, "Program.cs"));
        var dashboard = File.ReadAllText(Path.Combine(root, "Components", "Pages", "Dashboard.razor"));
        var controls = File.ReadAllText(Path.Combine(root, "Components", "Pages", "Controls.razor"));
        var css = File.ReadAllText(Path.Combine(root, "wwwroot", "css", "site.css"));
        var documentation = File.ReadAllText(Path.Combine(root, "docs", "wiki", "Deployment.md"));

        AssertContains(program, "deduplicated bottom-right snackbar configuration",
            "mud-snackbar-location-bottom-right",
            "PreventDuplicates = true",
            "ShowCloseIcon = true");
        AssertDoesNotContain(program, "global snackbar capacity cap", "MaxDisplayedSnackbars");
        AssertContains(dashboard, "Dashboard rejection outcome",
            "ThermostatCommandFeedback.IsRejectedBackoff(ex)",
            "ShowThermostatCommandRejected();",
            "options.RequireInteraction = true",
            "ThermostatCommandFeedback.RejectionSnackbarKey");
        AssertContains(controls, "Controls rejection outcome",
            "ThermostatCommandFeedback.IsRejectedBackoff(ex)",
            "ShowThermostatCommandRejected();",
            "options.RequireInteraction = true",
            "ThermostatCommandFeedback.RejectionSnackbarKey");
        AssertContains(css, "narrow snackbar viewport contract",
            "#mud-snackbar-container",
            "calc(100vw - 32px)",
            "@media (max-width: 600px)",
            "safe-area-inset-left",
            "min-width: 0",
            "overflow-wrap: anywhere");
        AssertContains(documentation, "safe climate rejection documentation",
            "bounded", "HTTP status", "does not retain request headers", "upstream response bodies", "identical-command backoff");
    }

    public void MudBlazorSuppressesRepeatedPersistentOutcomeWithoutCapacityCap()
    {
        var configuration = new SnackbarConfiguration
        {
            PreventDuplicates = true,
            MaxDisplayedSnackbars = 5,
        };

        using var snackbar = new SnackbarService(
            new TestNavigationManager(),
            TimeProvider.System,
            Options.Create(configuration));

        var first = snackbar.Add(
            ThermostatCommandFeedback.RejectionSnackbarMessage,
            Severity.Error,
            options => options.RequireInteraction = true,
            ThermostatCommandFeedback.RejectionSnackbarKey);
        var second = snackbar.Add(
            ThermostatCommandFeedback.RejectionSnackbarMessage,
            Severity.Error,
            options => options.RequireInteraction = true,
            ThermostatCommandFeedback.RejectionSnackbarKey);

        if (first is null || second is not null || snackbar.ShownSnackbars.Count() != 1)
        {
            throw new InvalidOperationException(
                "MudBlazor must reject a repeated persistent thermostat outcome before it enters the normal five-snackbar display list.");
        }
    }

    private static void AssertContains(string text, string subject, params string[] requiredFragments)
    {
        foreach (var fragment in requiredFragments)
        {
            if (!text.Contains(fragment, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"{subject} must contain '{fragment}'.");
            }
        }
    }

    private static void AssertDoesNotContain(string text, string subject, string forbiddenFragment)
    {
        if (text.Contains(forbiddenFragment, StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"{subject} must not contain '{forbiddenFragment}'.");
        }
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null && !File.Exists(Path.Combine(directory.FullName, "HomeAssistantAcDefender.csproj")))
        {
            directory = directory.Parent;
        }

        return directory?.FullName
            ?? throw new InvalidOperationException("Could not find the HomeAssistantAcDefender repository root.");
    }

    private sealed class TestNavigationManager : NavigationManager
    {
        public TestNavigationManager() => Initialize("https://test.invalid/", "https://test.invalid/");
    }
}
