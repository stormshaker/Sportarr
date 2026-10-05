namespace Sportarr.Api.Services;

/// <summary>
/// Gives each indexer request attempt its own IndexerHttpTimeoutSeconds.
///
/// The IndexerClient's own timeout used to be that setting, and an HttpClient
/// timeout covers the whole pipeline: every retry, the backoff between them,
/// and the per-host pacing wait. So a transient 5xx on an indexer with a
/// request delay left the retries too little time to run, and the attempt that
/// would have succeeded was never sent. This handler sits inside the retry
/// policy and below the pacer, so it times only the request itself, and the
/// client timeout becomes a ceiling for the whole chain.
///
/// A timed-out attempt fails the way the client timeout did, with a
/// TaskCanceledException wrapping a TimeoutException, and the transient-error
/// retry policy does not retry it, so a slow indexer is not tried four times.
/// </summary>
public sealed class IndexerAttemptTimeoutHandler : DelegatingHandler
{
    internal const int DefaultTimeoutSeconds = 30;
    internal const int MinimumTimeoutSeconds = 5;

    private readonly IServiceProvider _services;

    // ConfigService is resolved per request and may be absent, as it is in a
    // service collection that only composes the HTTP clients. Without it the
    // attempt gets the default, as the client timeout did before.
    public IndexerAttemptTimeoutHandler(IServiceProvider services)
    {
        _services = services;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var timeout = await AttemptTimeoutAsync(_services.GetService(typeof(ConfigService)) as ConfigService);
        using var attempt = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        attempt.CancelAfter(timeout);
        try
        {
            return await base.SendAsync(request, attempt.Token);
        }
        catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested && attempt.IsCancellationRequested)
        {
            throw new TaskCanceledException(
                $"The indexer request was canceled after the configured {timeout.TotalSeconds:0} second timeout elapsed.",
                new TimeoutException(ex.Message, ex));
        }
    }

    internal static async Task<TimeSpan> AttemptTimeoutAsync(ConfigService? configService)
    {
        if (configService == null)
            return TimeSpan.FromSeconds(DefaultTimeoutSeconds);
        try
        {
            var config = await configService.GetConfigAsync();
            return TimeSpan.FromSeconds(Math.Max(MinimumTimeoutSeconds, config.IndexerHttpTimeoutSeconds));
        }
        catch
        {
            // Config not readable yet (very early startup) - keep the default.
            return TimeSpan.FromSeconds(DefaultTimeoutSeconds);
        }
    }
}
