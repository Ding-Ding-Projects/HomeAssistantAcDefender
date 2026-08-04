using HomeAssistantAcDefender.Services;

internal sealed class UiLanguageRegressionTests
{
    public void FunnyLevelsAreIndependentAndBounded()
    {
        const string english = "The defender is watching.";
        const string cantonese = "衛兵睇緊。";

        AssertEqual(english, FunnyTone.English(english, 0), "English level 0 should clamp to serious copy.");
        AssertEqual(english, FunnyTone.English(english, 1), "English level 1 should be factual copy.");
        AssertNotEqual(english, FunnyTone.English(english, 5), "English level 5 should style the copy.");
        AssertEqual(cantonese, FunnyTone.Cantonese(cantonese, 1), "Cantonese level 1 should be factual copy.");
        AssertNotEqual(cantonese, FunnyTone.Cantonese(cantonese, 5), "Cantonese level 5 should style the copy.");
        AssertTrue(FunnyTone.English(english, 5).Contains(english, StringComparison.Ordinal), "English styling must preserve the facts.");
        AssertTrue(FunnyTone.Cantonese(cantonese, 5).Contains(cantonese, StringComparison.Ordinal), "Cantonese styling must preserve the facts.");
    }

    private static void AssertEqual(string expected, string actual, string message)
    {
        if (!string.Equals(expected, actual, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(message);
        }
    }

    private static void AssertNotEqual(string expected, string actual, string message)
    {
        if (string.Equals(expected, actual, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(message);
        }
    }

    private static void AssertTrue(bool condition, string message)
    {
        if (!condition)
        {
            throw new InvalidOperationException(message);
        }
    }
}
