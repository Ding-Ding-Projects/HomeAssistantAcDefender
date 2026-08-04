using HomeAssistantAcDefender.Services;

internal sealed class RegexSearchMatcherTests
{
    public void PlainTextRemainsAndSearchesEveryValue()
    {
        if (!RegexSearchMatcher.Matches("wall touch", "plain", "im", "A wall-touch response", "safe correction")
            || RegexSearchMatcher.Matches("wall missing", "plain", "im", "A wall-touch response", "safe correction"))
        {
            throw new InvalidOperationException("Plain search must keep space-separated AND semantics across every supplied value.");
        }
    }

    public void RegexFlagsAndInvalidOrOversizedPatternsAreBounded()
    {
        if (!RegexSearchMatcher.Matches("^guard-(cool|warm)$", "regex", "i", "GUARD-COOL")
            || RegexSearchMatcher.Matches("[", "regex", "im", "anything")
            || RegexSearchMatcher.Matches(new string('a', RegexSearchMatcher.MaxPatternLength + 1), "regex", "im", "anything"))
        {
            throw new InvalidOperationException("Regex matching must honour flags while rejecting invalid and oversized patterns.");
        }
    }

    public void RegexTimeoutAndValueBoundsDoNotThrow()
    {
        var adversarial = "^(a+)+$";
        var longValue = new string('a', RegexSearchMatcher.MaxValueLength + 500) + "!";
        _ = RegexSearchMatcher.Matches(adversarial, "regex", "", longValue);
    }
}
