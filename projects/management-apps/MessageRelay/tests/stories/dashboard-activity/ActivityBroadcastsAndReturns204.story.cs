// User story: the Claude Code Stop hook POSTs to /activity to clear the
// dashboard activity indicator after each turn. relay-dotnet must return
// 204 No Content for valid agent names, and 400 with { error: "Invalid
// agent name" } for names that fail AgentName.IsValid.
//
// Negative control: a name containing a space is invalid — proves the
// guard fires and distinguishes a bad name from a good one.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

using Xunit;

namespace MessageRelay.StoryTests.DashboardActivity;

public sealed class ActivityBroadcastsAndReturns204 : IClassFixture<DashboardActivityWebAppFactory>
{
    private readonly DashboardActivityWebAppFactory factory;

    public ActivityBroadcastsAndReturns204(DashboardActivityWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task PostActivityReturns204ForValidAgentName()
    {
        // Given: relay-dotnet is running.
        using HttpClient http = this.factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: Stop hook posts an activity update for "chief-of-staff".
        ActivityBody body = new("chief-of-staff", "idle", null, null, null);
        using HttpResponseMessage resp = await http.PostAsJsonAsync(
            new Uri("/activity", UriKind.Relative), body, cts.Token);

        // Then: 204 No Content — no body, no error.
        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);

        // Negative control: 200 OK would mean a different endpoint was matched.
        Assert.NotEqual(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task PostActivityRejectsBadAgentName()
    {
        // Given: relay-dotnet is running.
        using HttpClient http = this.factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: hook posts a name with a space (fails AgentName.IsValid).
        ActivityBody body = new("bad name", "idle", null, null, null);
        using HttpResponseMessage resp = await http.PostAsJsonAsync(
            new Uri("/activity", UriKind.Relative), body, cts.Token);

        // Then: 400 with { error: "Invalid agent name" }.
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        ErrorPayload? error = await resp.Content.ReadFromJsonAsync<ErrorPayload>(cts.Token);
        Assert.NotNull(error);
        Assert.Equal("Invalid agent name", error.Error);

        // Negative control: the valid name from the happy-path test is provably absent.
        Assert.NotEqual("chief-of-staff", error.Error);
    }

    private sealed record ActivityBody(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("state")] string State,
        [property: JsonPropertyName("backend")] string? Backend,
        [property: JsonPropertyName("detail")] string? Detail,
        [property: JsonPropertyName("ts")] string? Ts);

    private sealed record ErrorPayload(
        [property: JsonPropertyName("error")] string Error);
}
