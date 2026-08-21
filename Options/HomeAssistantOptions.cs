using System.Globalization;
using System.Net;

namespace HomeAssistantAcDefender.Options;

public sealed class HomeAssistantOptions
{
    public const string SectionName = "HomeAssistant";

    public string BaseUrl { get; set; } = "http://127.0.0.1:8123";

    // Explicit, narrow compatibility switch for private-LAN Home Assistant instances that do
    // not terminate TLS. Public or ambiguous HTTP targets remain rejected even when enabled.
    public bool AllowInsecurePrivateNetworkHttp { get; set; }

    public string? AccessToken { get; set; }

    public string EntityId { get; set; } = "climate.dining_room";

    public string WeatherEntityId { get; set; } = "";

    public string OutdoorTemperatureEntityId { get; set; } = "";

    // Key-free Open-Meteo fallback. Home Assistant weather and outdoor-temperature entities
    // always remain the primary sources. When coordinates are omitted, the app reads the real
    // installation latitude/longitude from Home Assistant's /api/config endpoint.
    public bool OpenMeteoBackupEnabled { get; set; } = true;

    public double? OpenMeteoLatitude { get; set; }

    public double? OpenMeteoLongitude { get; set; }

    // The client enforces a ten-minute minimum even if configuration asks for less.
    public int OpenMeteoRefreshMinutes { get; set; } = 30;

    public string UsagePowerEntityId { get; set; } = "sensor.alectra_hui_current_power";

    public string UsageEnergyEntityId { get; set; } = "sensor.alectra_hui_energy_today";

    public string UsageCostEntityId { get; set; } = "sensor.alectra_hui_cost_today";

    public string UsageHourlyCostEntityId { get; set; } = "sensor.alectra_hui_hourly_cost";

    public string UsageCurrentBillEntityId { get; set; } = "sensor.alectra_hui_current_bill";

    public string UsageCurrentBillDueEntityId { get; set; } = "sensor.alectra_hui_current_bill_due";

    public string UsageCurrentBillStatusEntityId { get; set; } = "sensor.alectra_hui_current_bill_status";

    public string? Username { get; set; }

    public string? Password { get; set; }

    // Adjustment-statistics context entities (all optional). The tracked person is a nickname-labelled
    // presence/person/device_tracker entity; the master-bedroom triggers are any motion/occupancy
    // sensors and/or lights whose "on" means the (hottest) bedroom is occupied.
    public string TrackedPersonLabel { get; set; } = "Taylor Swift";

    public string TrackedPersonEntityIds { get; set; } = "";

    public string MasterBedroomEntityIds { get; set; } = "";

    // Home Assistant notify service name (e.g. "mobile_app_owner_phone" → notify.mobile_app_owner_phone)
    // used by the Desired-State Enforcer. Empty disables notifications even if the Enforcer asks for one.
    public string NotifyService { get; set; } = "";
}

public static class HomeAssistantConfigurationValidator
{
    public static Uri ValidateBaseUrl(string? value, bool allowInsecurePrivateNetworkHttp = false)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException("HomeAssistant:BaseUrl must be an absolute HTTP(S) URL.");
        }

        var trimmed = value.Trim();
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || string.IsNullOrWhiteSpace(uri.Host)
            || !string.IsNullOrEmpty(uri.UserInfo)
            || !string.IsNullOrEmpty(uri.Query)
            || !string.IsNullOrEmpty(uri.Fragment)
            || uri.Host.Contains('%'))
        {
            throw new InvalidOperationException("HomeAssistant:BaseUrl must be an absolute HTTP(S) URL without credentials, query strings, fragments, or ambiguous host syntax.");
        }

        var isLoopback = IsLoopbackHost(uri.Host);
        if (uri.Scheme == Uri.UriSchemeHttp && !isLoopback)
        {
            if (!allowInsecurePrivateNetworkHttp)
            {
                throw new InvalidOperationException("HomeAssistant:BaseUrl must use HTTPS for non-loopback hosts; enable HomeAssistant:AllowInsecurePrivateNetworkHttp only for a bounded private-LAN compatibility route.");
            }

            if (!IsPrivateNetworkHost(uri.Host))
            {
                throw new InvalidOperationException("HomeAssistant:AllowInsecurePrivateNetworkHttp permits only RFC1918, link-local, or .local Home Assistant hosts; public HTTP is rejected.");
            }
        }

        return uri;
    }

    public static IReadOnlyList<string> ValidateAllowedHosts(string? raw)
    {
        var entries = SplitBoundedList(raw, "ForwardedHeaders:AllowedHosts");
        if (entries.Count == 0)
        {
            return new[] { "localhost", "127.0.0.1", "[::1]" };
        }

        foreach (var entry in entries)
        {
            if (entry is "*" or "")
            {
                throw new InvalidOperationException("ForwardedHeaders:AllowedHosts must not contain wildcard or empty hosts.");
            }

            if (entry.Any(char.IsWhiteSpace)
                || (entry != "[::1]" && entry.Contains(':'))
                || entry.Contains('/')
                || entry.Contains('@')
                || entry.Contains('?')
                || entry.Contains('#')
                || entry.Contains('*')
                || entry.StartsWith(".", StringComparison.Ordinal)
                || entry.EndsWith(".", StringComparison.Ordinal))
            {
                throw new InvalidOperationException("ForwardedHeaders:AllowedHosts must contain host names without ports, credentials, wildcards, paths, or ambiguous punctuation.");
            }

            if (entry != "[::1]" && Uri.CheckHostName(entry) == UriHostNameType.Unknown)
            {
                throw new InvalidOperationException("ForwardedHeaders:AllowedHosts contains an invalid host name.");
            }
        }

        return entries;
    }

    public static IReadOnlyList<IPAddress> ValidateKnownProxies(string? raw)
    {
        var entries = SplitBoundedList(raw, "ForwardedHeaders:KnownProxies");
        var addresses = new List<IPAddress>(entries.Count);
        foreach (var entry in entries)
        {
            if (!IPAddress.TryParse(entry, out var address)
                || IsAnyAddress(address)
                || HasAmbiguousIpv4LeadingZero(entry, address))
            {
                throw new InvalidOperationException("ForwardedHeaders:KnownProxies contains a malformed, wildcard, or ambiguous IP address.");
            }

            addresses.Add(address);
        }

        return addresses;
    }

    public static IReadOnlyList<IPNetwork> ValidateKnownNetworks(string? raw)
    {
        var entries = SplitBoundedList(raw, "ForwardedHeaders:KnownIPNetworks");
        var networks = new List<IPNetwork>(entries.Count);
        foreach (var entry in entries)
        {
            var slash = entry.IndexOf('/');
            if (slash <= 0 || slash != entry.LastIndexOf('/'))
            {
                throw new InvalidOperationException("ForwardedHeaders:KnownIPNetworks must contain IP/CIDR values.");
            }

            var addressText = entry[..slash];
            var prefixText = entry[(slash + 1)..];
            if (!IPAddress.TryParse(addressText, out var address)
                || HasAmbiguousIpv4LeadingZero(addressText, address)
                || prefixText.Length == 0
                || (prefixText.Length > 1 && prefixText.StartsWith("0", StringComparison.Ordinal))
                || !int.TryParse(prefixText, NumberStyles.None, CultureInfo.InvariantCulture, out var prefixLength))
            {
                throw new InvalidOperationException("ForwardedHeaders:KnownIPNetworks contains a malformed IP/CIDR value.");
            }

            var maxPrefix = address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork ? 32 : 128;
            if (prefixLength <= 0 || prefixLength > maxPrefix)
            {
                throw new InvalidOperationException("ForwardedHeaders:KnownIPNetworks must not contain a zero-length or oversized network prefix.");
            }

            networks.Add(System.Net.IPNetwork.Parse($"{address}/{prefixLength}"));
        }

        return networks;
    }

    public static void RunNegativeRegression()
    {
        ExpectThrows(() => ValidateBaseUrl("http://public.example", false));
        ExpectThrows(() => ValidateBaseUrl("https://user:password@ha.example", false));
        ExpectThrows(() => ValidateBaseUrl("https://ha.example/#fragment", false));
        ExpectThrows(() => ValidateBaseUrl("http://public.example", true));
        ValidateBaseUrl("http://127.0.0.1:8123", false);
        ValidateBaseUrl("http://ha.local:8123", true);
        ValidateBaseUrl("http://192.168.1.20:8123", true);
        ExpectThrows(() => ValidateKnownNetworks("10.0.0.0/0"));
        ExpectThrows(() => ValidateKnownNetworks("10.0.0.0/00"));
        ExpectThrows(() => ValidateKnownProxies("0.0.0.0"));
        ExpectThrows(() => ValidateAllowedHosts("ha.example:8123"));
        ExpectThrows(() => ValidateAllowedHosts("*"));
        Console.WriteLine("deployment-configuration validator negative regressions passed (red/green fixture set).");
    }

    private static List<string> SplitBoundedList(string? raw, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new List<string>();
        }

        var entries = raw.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).ToList();
        if (entries.Count > 16 || entries.Any(entry => entry.Length > 64))
        {
            throw new InvalidOperationException($"{fieldName} must contain at most 16 entries of at most 64 characters each.");
        }

        return entries;
    }

    private static bool IsLoopbackHost(string host)
    {
        return string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase)
            || IPAddress.TryParse(host, out var address) && IPAddress.IsLoopback(address);
    }

    private static bool IsPrivateNetworkHost(string host)
    {
        if (host.EndsWith(".local", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (!IPAddress.TryParse(host, out var address))
        {
            return false;
        }

        var bytes = address.GetAddressBytes();
        if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            return bytes[0] == 10
                || bytes[0] == 172 && bytes[1] is >= 16 and <= 31
                || bytes[0] == 192 && bytes[1] == 168
                || bytes[0] == 169 && bytes[1] == 254;
        }

        return bytes.Length == 16 && bytes[0] == 0xfe && (bytes[1] & 0xc0) == 0x80;
    }

    private static bool IsAnyAddress(IPAddress address)
    {
        return address.Equals(IPAddress.Any) || address.Equals(IPAddress.IPv6Any);
    }

    private static bool HasAmbiguousIpv4LeadingZero(string text, IPAddress address)
    {
        return address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork
            && text.Split('.').Any(part => part.Length > 1 && part.StartsWith("0", StringComparison.Ordinal));
    }

    private static void ExpectThrows(Action action)
    {
        try
        {
            action();
        }
        catch (InvalidOperationException)
        {
            return;
        }

        throw new InvalidOperationException("Deployment configuration negative regression did not reject its invalid fixture.");
    }
}
