using System.Globalization;
using Microsoft.AspNetCore.Http;

namespace Sportarr.Api.Helpers;

/// <summary>
/// Search, filter, sort and page a cached metadata catalog (the team and
/// league pickers) on the server, so the browser receives the rows it is
/// about to draw instead of the whole catalog.
///
/// Every parameter is optional. A request with none of them gets every row,
/// ordered by name, with the catalog's placeholder rows removed.
/// </summary>
public sealed record CatalogQuery(
    string? Search,
    string? Sport,
    string? SortBy,
    bool Descending,
    IReadOnlyDictionary<string, string> ColumnFilters,
    int? Limit)
{
    /// <summary>Rows matching the query, before the limit.</summary>
    public const string TotalCountHeader = "X-Total-Count";

    /// <summary>Selectable rows in the whole catalog, before any query.</summary>
    public const string CatalogCountHeader = "X-Catalog-Count";

    private const string FilterPrefix = "filter.";

    private static readonly StringComparer SortComparer =
        StringComparer.Create(CultureInfo.InvariantCulture, CompareOptions.IgnoreCase);

    /// <summary>
    /// Reads <c>q</c>, <c>sport</c>, <c>sort</c>, <c>dir</c>, <c>limit</c> and
    /// any number of <c>filter.&lt;column&gt;</c> values. The column filters
    /// are the compact table's per-column filters, which have to run here once
    /// the browser only holds one page of the catalog.
    /// </summary>
    public static CatalogQuery FromRequest(IQueryCollection query)
    {
        var filters = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var (key, value) in query)
        {
            if (!key.StartsWith(FilterPrefix, StringComparison.OrdinalIgnoreCase)) continue;
            var column = key[FilterPrefix.Length..];
            var term = value.ToString().Trim();
            if (column.Length > 0 && term.Length > 0)
                filters[column] = term;
        }

        int? limit = int.TryParse(query["limit"].ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out var parsed) && parsed > 0
            ? parsed
            : null;

        return new CatalogQuery(
            Blank(query["q"].ToString()),
            Blank(query["sport"].ToString()),
            Blank(query["sort"].ToString()),
            string.Equals(query["dir"].ToString(), "desc", StringComparison.OrdinalIgnoreCase),
            filters,
            limit);
    }

    /// <summary>
    /// Applies the query. <paramref name="columns"/> names the sortable and
    /// filterable columns. A sort or filter on any other column is ignored
    /// rather than rejected, so a stale client cannot break the page.
    /// </summary>
    public CatalogPage<T> Apply<T>(
        IEnumerable<T> items,
        Func<T, string?> name,
        Func<T, string?> sport,
        Func<T, IEnumerable<string?>> searchFields,
        IReadOnlyDictionary<string, Func<T, string?>> columns)
    {
        // Rows like "_No League Fighting" and "_Defunct Tennis Teams" group the
        // catalog internally and are not something a user can add.
        var selectable = items.Where(item => !IsPlaceholder(name(item))).ToList();
        IEnumerable<T> matches = selectable;

        if (Sport != null)
        {
            // Equality rather than a substring, so "Football" does not pull in
            // "Australian Football". Case-insensitive because the catalog ships
            // both "Motorsport" and "MotorSport".
            matches = matches.Where(item => string.Equals(sport(item)?.Trim(), Sport, StringComparison.OrdinalIgnoreCase));
        }

        if (Search != null)
        {
            matches = matches.Where(item => searchFields(item).Any(field => Contains(field, Search)));
        }

        foreach (var (column, term) in ColumnFilters)
        {
            if (!columns.TryGetValue(column, out var value)) continue;
            matches = matches.Where(item => Contains(value(item), term));
        }

        var sortKey = SortBy != null && columns.TryGetValue(SortBy, out var selected) ? selected : name;
        var ordered = Descending
            ? matches.OrderByDescending(item => sortKey(item) ?? string.Empty, SortComparer)
            : matches.OrderBy(item => sortKey(item) ?? string.Empty, SortComparer);

        // Name breaks ties so a page boundary never moves between two requests.
        var all = ordered.ThenBy(item => name(item) ?? string.Empty, SortComparer).ToList();
        var page = Limit is { } limit ? all.Take(limit).ToList() : all;
        return new CatalogPage<T>(page, all.Count, selectable.Count);
    }

    /// <summary>Writes the two count headers the pickers read.</summary>
    public static void WriteCountHeaders(HttpResponse response, int matched, int catalog)
    {
        response.Headers[TotalCountHeader] = matched.ToString(CultureInfo.InvariantCulture);
        response.Headers[CatalogCountHeader] = catalog.ToString(CultureInfo.InvariantCulture);
    }

    private static bool IsPlaceholder(string? name)
    {
        var trimmed = name?.Trim();
        return !string.IsNullOrEmpty(trimmed) && (trimmed.StartsWith('_') || trimmed.EndsWith('_'));
    }

    private static bool Contains(string? value, string term) =>
        !string.IsNullOrEmpty(value) && value.Contains(term, StringComparison.OrdinalIgnoreCase);

    private static string? Blank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

public sealed record CatalogPage<T>(List<T> Rows, int Matched, int Catalog);
