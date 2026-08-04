using System.Diagnostics;
using HomeAssistantAcDefender.Services;

internal sealed class ChangelogCatalogTests
{
    public void CatalogEntriesHaveTraceableCommits()
    {
        var entries = ChangelogCatalog.Entries;
        if (entries.Count < 80)
        {
            throw new InvalidOperationException($"Expected the published release catalog, found only {entries.Count} entries.");
        }

        if (entries.Select(entry => entry.Version).Distinct(StringComparer.OrdinalIgnoreCase).Count() != entries.Count)
        {
            throw new InvalidOperationException("Changelog versions must be unique.");
        }

        foreach (var entry in entries)
        {
            if (entry.CommitSha.Length != 40 || entry.CommitSha.Any(character => !Uri.IsHexDigit(character)))
            {
                throw new InvalidOperationException($"Changelog entry {entry.Version} has an invalid commit SHA.");
            }

            if (entry.ReleaseDate == default || string.IsNullOrWhiteSpace(entry.CodeName) || string.IsNullOrWhiteSpace(entry.Summary))
            {
                throw new InvalidOperationException($"Changelog entry {entry.Version} is missing factual metadata.");
            }

            AssertCommitExists(entry.CommitSha, entry.Version);
        }
    }

    private static void AssertCommitExists(string sha, string version)
    {
        var root = FindGitRoot();
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "git",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardError = true
            }
        };
        process.StartInfo.ArgumentList.Add("-C");
        process.StartInfo.ArgumentList.Add(root);
        process.StartInfo.ArgumentList.Add("cat-file");
        process.StartInfo.ArgumentList.Add("-e");
        process.StartInfo.ArgumentList.Add($"{sha}^{{commit}}");
        process.Start();
        process.WaitForExit();
        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException($"Changelog entry {version} points at missing commit {sha}.");
        }
    }

    private static string FindGitRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            if (File.Exists(Path.Combine(current.FullName, ".git")) ||
                Directory.Exists(Path.Combine(current.FullName, ".git")))
            {
                return current.FullName;
            }

            current = current.Parent;
        }

        throw new InvalidOperationException("Unable to locate the Git checkout for changelog SHA verification.");
    }
}
