using HomeAssistantAcDefender.Services;

internal sealed class DimSumSurpriseTests
{
    public void CatalogUsesAuthoritativeMetadataAndPublishedAssets()
    {
        if (!DimSumSurpriseService.CatalogSourceUrl.EndsWith(
                "/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json",
                StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The dim-sum metadata cache must name the public catalog source.");
        }

        if (DimSumSurpriseService.CatalogRevision.Length != 40
            || !DimSumSurpriseService.CatalogRevision.All(Uri.IsHexDigit))
        {
            throw new InvalidOperationException("The dim-sum metadata cache must record an exact catalog revision.");
        }

        if (DimSumSurpriseService.Catalog.Count < 3)
        {
            throw new InvalidOperationException("The bounded surprise catalog needs more than one published dish so the selected dish is genuinely random.");
        }

        foreach (var dish in DimSumSurpriseService.Catalog)
        {
            if (string.IsNullOrWhiteSpace(dish.EnglishName)
                || string.IsNullOrWhiteSpace(dish.TraditionalName)
                || string.IsNullOrWhiteSpace(dish.EnglishAlt)
                || string.IsNullOrWhiteSpace(dish.CantoneseAlt)
                || !dish.ImageUrl.StartsWith(
                    "https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/",
                    StringComparison.Ordinal)
                || !dish.ImageUrl.EndsWith(".png", StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"Dim-sum record {dish.Id} is missing bilingual metadata or a published immutable PNG URL.");
            }
        }
    }

    public void DrawGateIsExactlyTenPercentAndDeterministic()
    {
        if (DimSumSurpriseService.DrawBasisPoints * 10 != DimSumSurpriseService.DrawBuckets)
        {
            throw new InvalidOperationException("The startup surprise draw must be exactly 10% of its random buckets.");
        }

        var first = DimSumSurpriseService.TryDraw(0, 0)
            ?? throw new InvalidOperationException("The first draw bucket should show the first catalog dish.");
        if (first.Id != DimSumSurpriseService.Catalog[0].Id)
        {
            throw new InvalidOperationException("Deterministic draw selection changed the catalog identity.");
        }

        if (DimSumSurpriseService.TryDraw(DimSumSurpriseService.DrawBasisPoints, 0) is not null
            || DimSumSurpriseService.TryDraw(DimSumSurpriseService.DrawBuckets - 1, DimSumSurpriseService.Catalog.Count - 1) is not null)
        {
            throw new InvalidOperationException("The draw gate must stop at the 10% boundary and never draw above it.");
        }

        var last = DimSumSurpriseService.TryDraw(1, DimSumSurpriseService.Catalog.Count - 1)
            ?? throw new InvalidOperationException("A successful draw should select the requested catalog row.");
        if (last.Id != DimSumSurpriseService.Catalog[^1].Id)
        {
            throw new InvalidOperationException("A successful draw did not preserve the selected published dish.");
        }
    }

    public void DrawRejectsInvalidBuckets()
    {
        AssertThrows<ArgumentOutOfRangeException>(() => DimSumSurpriseService.TryDraw(-1, 0));
        AssertThrows<ArgumentOutOfRangeException>(() => DimSumSurpriseService.TryDraw(DimSumSurpriseService.DrawBuckets, 0));
        AssertThrows<ArgumentOutOfRangeException>(() => DimSumSurpriseService.TryDraw(0, -1));
        AssertThrows<ArgumentOutOfRangeException>(() => DimSumSurpriseService.TryDraw(0, DimSumSurpriseService.Catalog.Count));
    }

    private static void AssertThrows<TException>(Action action)
        where TException : Exception
    {
        try
        {
            action();
        }
        catch (TException)
        {
            return;
        }

        throw new InvalidOperationException($"Expected {typeof(TException).Name}.");
    }
}
