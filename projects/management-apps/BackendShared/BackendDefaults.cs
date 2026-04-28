using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace BackendShared;

/// <summary>
/// Project-specific defaults for the .NET backend experiment. Layers wire-format
/// conventions on top of Aspire's <c>AddServiceDefaults()</c> from the
/// <c>ManagementApps.ServiceDefaults</c> project — camelCase JSON, ProblemDetails,
/// rejection of unknown JSON properties.
/// </summary>
/// <remarks>
/// OBSERVABILITY REGISTRATION CAVEAT — ServiceDefaults registers
/// <c>tracing.AddSource(ApplicationName)</c> implicitly, but ApplicationName drifts
/// when a service runs under a test-only AppHost (the test entry-point assembly
/// becomes the ApplicationName, not the SUT). The Meter scope is not registered
/// by ServiceDefaults at all. Each service that declares its own
/// <c>ActivitySource</c>/<c>Meter</c> MUST register them explicitly in
/// <c>Program.cs</c> after <c>AddBackendDefaults()</c>:
/// <code>
/// builder.Services.ConfigureOpenTelemetryTracerProvider(t =&gt; t.AddSource("MyService"));
/// builder.Services.ConfigureOpenTelemetryMeterProvider(m =&gt; m.AddMeter("MyService"));
/// </code>
/// Belt-and-suspenders. Discovered by content-service-dotnet during cross-stack
/// test harness setup — implicit registration silently drops spans/metrics in
/// Tests.AppHost runs.
/// </remarks>
public static class BackendDefaults
{
    /// <summary>
    /// Calls <c>builder.AddServiceDefaults()</c> (Aspire OTel + health + resilience
    /// + service discovery) and adds:
    /// <list type="bullet">
    ///   <item>System.Text.Json camelCase property naming + strict deserialization</item>
    ///   <item>RFC 9457 ProblemDetails for error responses</item>
    /// </list>
    /// Call once from <c>Program.cs</c> before <c>builder.Build()</c>.
    /// </summary>
    public static TBuilder AddBackendDefaults<TBuilder>(this TBuilder builder)
        where TBuilder : IHostApplicationBuilder
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.AddServiceDefaults();

        builder.Services.ConfigureHttpJsonOptions(opts =>
        {
            opts.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
            opts.SerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
            // Reject unknown properties — wire schema is the contract.
            opts.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
            // Pretty errors during dev only; production stays compact.
            opts.SerializerOptions.WriteIndented = builder.Environment.IsDevelopment();
            opts.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });

        builder.Services.AddProblemDetails();

        return builder;
    }
}
