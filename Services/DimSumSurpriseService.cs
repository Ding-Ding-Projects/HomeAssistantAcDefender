using System.Security.Cryptography;

namespace HomeAssistantAcDefender.Services;

/// <summary>
/// Selects the optional startup dim-sum delight without copying the public photo catalog into
/// this application. The small metadata cache below is pinned to the catalog revision recorded
/// in <see cref="CatalogRevision"/>; photographs remain immutable public release URLs.
/// </summary>
public static class DimSumSurpriseService
{
    public const int DrawBuckets = 1_000;
    public const int DrawBasisPoints = 100; // 100 / 1,000 = exactly 10%.
    public const string CatalogSourceUrl =
        "https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json";
    public const string CatalogRevision = "f77ea1169db0bfc17365414c44ff495a823c6823";
    public const string CatalogReleaseTag = "catalog-v1";
    public const string CatalogRepository = "Ding-Ding-Projects/dim-sum-photos";

    // Bounded offline metadata cache. Every row was read from CatalogSourceUrl at
    // CatalogRevision and cross-checked against a published catalog-v1 release asset. Do not add
    // image bytes or records whose metadata and release asset cannot both be proven.
    public static IReadOnlyList<DimSumDish> Catalog { get; } =
    [
        new(
            "hk-dish-0001",
            "Classic Har Gow",
            "蝦餃",
            "Warm tea-house photograph of Classic Har Gow",
            "港式茶樓木枱上嘅蝦餃",
            "hk-dish-0001-classic-har-gow.png"),
        new(
            "hk-dish-0002",
            "Scallop Har Gow",
            "帶子蝦餃",
            "Warm tea-house photograph of Scallop Har Gow",
            "港式茶樓木枱上嘅帶子蝦餃",
            "hk-dish-0002-scallop-har-gow.png"),
        new(
            "hk-dish-0003",
            "Bamboo Shoot Har Gow",
            "筍尖蝦餃",
            "Warm tea-house photograph of Bamboo Shoot Har Gow",
            "港式茶樓木枱上嘅筍尖蝦餃",
            "hk-dish-0003-bamboo-shoot-har-gow.png"),
        new(
            "hk-dish-0004",
            "Crab Roe Har Gow",
            "蟹籽蝦餃",
            "Warm tea-house photograph of Crab Roe Har Gow",
            "港式茶樓木枱上嘅蟹籽蝦餃",
            "hk-dish-0004-crab-roe-har-gow.png"),
        new(
            "hk-dish-0005",
            "Chive Shrimp Dumpling",
            "韭菜蝦餃",
            "Warm tea-house photograph of Chive Shrimp Dumpling",
            "港式茶樓木枱上嘅韭菜蝦餃",
            "hk-dish-0005-chive-shrimp-dumpling.png")
    ];

    /// <summary>Builds the immutable public release URL for one cached catalog row.</summary>
    public static string ImageUrl(DimSumDish dish) =>
        $"https://github.com/{CatalogRepository}/releases/download/{CatalogReleaseTag}/{dish.ImageFileName}";

    /// <summary>
    /// Performs one fresh per-launch draw. The caller must invoke this once per app launch;
    /// this method deliberately holds no persisted state.
    /// </summary>
    public static DimSumDish? TryDraw()
    {
        var chanceRoll = RandomNumberGenerator.GetInt32(DrawBuckets);
        var dishIndex = RandomNumberGenerator.GetInt32(Catalog.Count);
        return TryDraw(chanceRoll, dishIndex);
    }

    /// <summary>
    /// Deterministic draw seam used by regression tests. <paramref name="chanceRoll"/> is a
    /// bucket in [0, 999], so the first 100 buckets are exactly 10%.
    /// </summary>
    public static DimSumDish? TryDraw(int chanceRoll, int dishIndex)
    {
        if (chanceRoll is < 0 or >= DrawBuckets)
        {
            throw new ArgumentOutOfRangeException(nameof(chanceRoll), "The chance roll must be a 0–999 bucket.");
        }

        if (dishIndex < 0 || dishIndex >= Catalog.Count)
        {
            throw new ArgumentOutOfRangeException(nameof(dishIndex), "The dish index must point into the bounded catalog cache.");
        }

        return chanceRoll < DrawBasisPoints ? Catalog[dishIndex] : null;
    }
}

public sealed record DimSumDish(
    string Id,
    string EnglishName,
    string TraditionalName,
    string EnglishAlt,
    string CantoneseAlt,
    string ImageFileName)
{
    public string ImageUrl => DimSumSurpriseService.ImageUrl(this);
}
