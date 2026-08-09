using HomeAssistantAcDefender.Services;

namespace HomeAssistantAcDefender.Components.Shared;

public static class ThermostatCommandFeedback
{
    public const string RejectionSnackbarKey = "thermostat-command-outcome";

    // Keep the visible message stable so MudBlazor's duplicate prevention replaces a rejected
    // retry with the same factual outcome instead of stacking a second, less useful snackbar.
    public const string RejectionSnackbarMessage =
        "Home Assistant rejected the latest thermostat command. Automatic retries are paused; open Notifications for the HTTP status and operation.";

    public static bool IsRejectedBackoff(ThermostatCommandRetryDeferredException exception) =>
        exception.Reason == ThermostatCommandDeferralReason.RejectedBackoff;
}
