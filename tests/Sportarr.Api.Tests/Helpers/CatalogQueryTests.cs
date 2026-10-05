using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;
using Sportarr.Api.Helpers;
using Xunit;

namespace Sportarr.Api.Tests.Helpers;

public class CatalogQueryTests
{
    private sealed record Row(string Name, string Sport, string? Country = null, string? Alternate = null);

    private static readonly Row[] Catalog =
    {
        new("Norwich City", "Soccer", "England"),
        new("Adelaide Crows", "Australian Football", "Australia", "Crows"),
        new("_No League Fighting", "Fighting"),
        new("Melbourne Storm", "Rugby League", "Australia"),
        new("Adelaide United", "Soccer", "Australia"),
        new("Brisbane Broncos", "Rugby League", "Australia"),
        new("Placeholder_", "Soccer"),
    };

    private static readonly Dictionary<string, Func<Row, string?>> Columns = new(StringComparer.OrdinalIgnoreCase)
    {
        ["strTeam"] = r => r.Name,
        ["strSport"] = r => r.Sport,
        ["strCountry"] = r => r.Country,
    };

    private static CatalogQuery Parse(string query) =>
        CatalogQuery.FromRequest(new QueryCollection(ParseQueryString(query)));

    private static CatalogPage<Row> Run(string query) => Parse(query).Apply(
        Catalog,
        name: r => r.Name,
        sport: r => r.Sport,
        searchFields: r => new[] { r.Name, r.Alternate, r.Country },
        columns: Columns);

    private static Dictionary<string, StringValues> ParseQueryString(string query) =>
        query.Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(pair => pair.Split('=', 2))
            .GroupBy(parts => Uri.UnescapeDataString(parts[0]), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => new StringValues(group.Select(parts => parts.Length > 1 ? Uri.UnescapeDataString(parts[1]) : "").ToArray()),
                StringComparer.OrdinalIgnoreCase);

    [Fact]
    public void NoParametersReturnsEverySelectableRowByName()
    {
        var page = Run("");

        page.Rows.Select(r => r.Name).Should().Equal(
            "Adelaide Crows", "Adelaide United", "Brisbane Broncos", "Melbourne Storm", "Norwich City");
        page.Matched.Should().Be(5);
        page.Catalog.Should().Be(5);
    }

    [Fact]
    public void LimitTruncatesTheRowsButNotTheCounts()
    {
        var page = Run("limit=2");

        page.Rows.Select(r => r.Name).Should().Equal("Adelaide Crows", "Adelaide United");
        page.Matched.Should().Be(5);
        page.Catalog.Should().Be(5);
    }

    [Fact]
    public void SearchCoversEveryNamedFieldCaseInsensitively()
    {
        Run("q=crows").Rows.Select(r => r.Name).Should().Equal("Adelaide Crows");
        Run("q=ENGLAND").Rows.Select(r => r.Name).Should().Equal("Norwich City");
    }

    [Fact]
    public void SportIsAnExactMatchNotASubstring()
    {
        var page = Run("sport=football");

        page.Rows.Should().BeEmpty("\"Football\" must not pull in \"Australian Football\"");
        page.Catalog.Should().Be(5);
        Run("sport=australian%20football").Rows.Select(r => r.Name).Should().Equal("Adelaide Crows");
    }

    [Fact]
    public void ColumnFiltersApplyToTheWholeCatalog()
    {
        var page = Run("filter.strCountry=australia&filter.strSport=rugby&limit=1");

        page.Rows.Select(r => r.Name).Should().Equal("Brisbane Broncos");
        page.Matched.Should().Be(2);
    }

    [Fact]
    public void SortUsesTheNamedColumnWithNameBreakingTies()
    {
        Run("sort=strSport&dir=desc").Rows.Select(r => r.Name).Should().Equal(
            "Adelaide United", "Norwich City", "Brisbane Broncos", "Melbourne Storm", "Adelaide Crows");
    }

    [Fact]
    public void UnknownColumnsAreIgnoredRatherThanRejected()
    {
        Run("sort=nonsense&filter.nonsense=x").Rows.Should().HaveCount(5);
    }

    [Theory]
    [InlineData("limit=0")]
    [InlineData("limit=-5")]
    [InlineData("limit=lots")]
    public void AnUnusableLimitMeansNoLimit(string query)
    {
        Run(query).Rows.Should().HaveCount(5);
    }
}
