import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import fs from "node:fs";
import path from "node:path";
import type { RendererBenchmarkReport, RendererBenchmarkReportBundle } from "../../src/services/renderer-benchmark";

export default class RendererBenchmarkReporter implements Reporter {
  private readonly reports: RendererBenchmarkReport[] = [];

  onTestEnd(_test: TestCase, result: TestResult): void {
    for (const attachment of result.attachments) {
      if (attachment.name !== "renderer-benchmark-report" || !attachment.body) continue;
      this.reports.push(JSON.parse(attachment.body.toString("utf8")) as RendererBenchmarkReport);
    }
  }

  onEnd(_result: FullResult): void {
    const output = path.resolve(
      process.env.RENDERER_BENCHMARK_OUTPUT ?? "artifacts/renderer-benchmark-report.json"
    );
    const bundle: RendererBenchmarkReportBundle = {
      generatedAt: new Date().toISOString(),
      reports: this.reports,
      schemaVersion: 1
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(bundle, null, 2)}\n`);
  }
}
