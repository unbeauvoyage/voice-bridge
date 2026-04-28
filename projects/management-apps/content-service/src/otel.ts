import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const endpoint =
  process.env["OTEL_EXPORTER_OTLP_ENDPOINT"] ??
  process.env["DOTNET_DASHBOARD_OTLP_HTTP_ENDPOINT_URL"];

if (endpoint !== undefined && endpoint.length > 0) {
  const headersRaw = process.env["OTEL_EXPORTER_OTLP_HEADERS"] ?? "";
  const headers: Record<string, string> = {};
  for (const pair of headersRaw.split(",")) {
    const eq = pair.indexOf("=");
    if (eq > 0) {
      headers[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env["OTEL_SERVICE_NAME"] ?? "content-service",
      [ATTR_SERVICE_VERSION]: "0.1.0",
    }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${endpoint.replace(/\/$/, "")}/v1/traces`,
          headers,
        }),
      ),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        // fs instrumentation is disabled — file I/O is high-volume and spams traces.
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });
  sdk.start();
}
