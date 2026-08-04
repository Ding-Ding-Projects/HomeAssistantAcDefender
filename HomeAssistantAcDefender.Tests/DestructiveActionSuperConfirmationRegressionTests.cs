using System;
using System.IO;

internal sealed class DestructiveActionSuperConfirmationRegressionTests
{
    public void ControlsAndDashboardUseTheNativeThermostatOffGate()
    {
        var root = FindRepositoryRoot();
        var controls = File.ReadAllText(Path.Combine(root, "Components", "Pages", "Controls.razor"));
        var dashboard = File.ReadAllText(Path.Combine(root, "Components", "Pages", "Dashboard.razor"));

        AssertContains(controls, "Controls OFF gate",
            "id=\"controls-thermostat-off\"",
            "<DestructiveActionSuperConfirmation",
            "CommandSummary=\"climate.set_hvac_mode → off\"",
            "OnConfirmed=\"ConfirmThermostatOffGate\"",
            "OnCancelled=\"CancelThermostatOffGate\"",
            "BeginThermostatOffFromControls");
        AssertContains(dashboard, "Dashboard OFF gate",
            "id=\"dashboard-thermostat-off\"",
            "<DestructiveActionSuperConfirmation",
            "CommandSummary=\"climate.set_hvac_mode → off\"",
            "OnConfirmed=\"ConfirmThermostatOffGate\"",
            "OnCancelled=\"CancelThermostatOffGate\"");

        if (controls.Contains("@onclick=\"TurnOffFromControls\"", StringComparison.Ordinal)
            || dashboard.Contains("ShowMessageBoxAsync(\n            \"Turn off the real thermostat?\"", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The visible thermostat OFF routes must not bypass the native super-confirmation gate.");
        }
    }

    public void GateRequiresBothKeysAndFocusReturn()
    {
        var root = FindRepositoryRoot();
        var component = File.ReadAllText(Path.Combine(root, "Components", "Shared", "DestructiveActionSuperConfirmation.razor"));
        var css = File.ReadAllText(Path.Combine(root, "wwwroot", "css", "site.css"));
        var accessibility = File.ReadAllText(Path.Combine(root, "wwwroot", "js", "accessibility.js"));
        var docs = File.ReadAllText(Path.Combine(root, "docs", "wiki", "Super-confirmation.md"));

        AssertContains(component, "super-confirmation gate",
            "aria-modal=\"true\"",
            "Key 1",
            "Key 2",
            "!Armed",
            "_value = 100",
            "await OnConfirmed.InvokeAsync()",
            "Emergency exit",
            "args.Key.Equals(\"Escape\"",
            "ReturnFocusId",
            "deactivateModal");
        AssertContains(css, "super-confirmation reduced-motion contract",
            ".destructive-super-confirm__status--progress",
            ".destructive-super-confirm__status--complete",
            "@media (prefers-reduced-motion: reduce)");
        AssertContains(accessibility, "super-confirmation focus-return bridge", "focusElementById");
        AssertContains(docs, "super-confirmation documentation",
            "climate.dining_room",
            "climate.set_hvac_mode",
            "Emergency exit",
            "Suggested articles");
    }

    private static void AssertContains(string source, string contract, params string[] fragments)
    {
        foreach (var fragment in fragments)
        {
            if (!source.Contains(fragment, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"{contract} is missing required fragment '{fragment}'.");
            }
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
            ?? throw new InvalidOperationException("Could not locate the repository root for super-confirmation regression checks.");
    }
}
