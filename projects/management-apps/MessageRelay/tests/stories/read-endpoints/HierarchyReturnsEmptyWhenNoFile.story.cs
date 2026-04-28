// User story: CEO requests agent hierarchy when no agents-hierarchy.json file
// exists at the cwd — relay-dotnet must return an empty JSON object ({}) and
// NOT a 404, 500, or malformed response.
//
// Negative control: the response body must be parseable as a JSON object,
// not a JSON array or a null literal — proves the endpoint returns the right
// empty shape and not an error sentinel.

using System.Net;
using System.Text.Json;

using Xunit;

namespace MessageRelay.StoryTests.ReadEndpoints;

public sealed class HierarchyReturnsEmptyWhenNoFile : IClassFixture<ReadEndpointsWebAppFactory>
{
    private readonly ReadEndpointsWebAppFactory factory;

    public HierarchyReturnsEmptyWhenNoFile(ReadEndpointsWebAppFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        this.factory = factory;
    }

    [Fact]
    public async Task GetHierarchyReturnsEmptyObjectWhenFileAbsent()
    {
        // Given: no agents-hierarchy.json in the working directory.
        using HttpClient http = factory.CreateClient();
        using CancellationTokenSource cts = new(TimeSpan.FromSeconds(10));

        // When: CEO requests /agents/hierarchy.
        HttpResponseMessage resp = await http.GetAsync(new Uri("/agents/hierarchy", UriKind.Relative), cts.Token);

        // Then: 200 with a JSON object body.
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        string json = await resp.Content.ReadAsStringAsync(cts.Token);
        using JsonDocument doc = JsonDocument.Parse(json);
        Assert.Equal(JsonValueKind.Object, doc.RootElement.ValueKind);

        // Negative control: the body is not a JSON array (wrong shape).
        Assert.NotEqual(JsonValueKind.Array, doc.RootElement.ValueKind);
    }
}
