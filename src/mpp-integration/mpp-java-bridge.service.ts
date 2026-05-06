import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { CanonicalSchedulePayload } from "./canonical-schedule.types";

/**
 * Optional MPXJ-based reader for binary Microsoft Project files (.mpp).
 * Requires a JVM plus {@link MPXJ_BRIDGE_JAR} pointing at the shaded JAR from tools/mpxj-json-bridge.
 */
@Injectable()
export class MppJavaBridgeService {
  private readonly jarPath = process.env.MPXJ_BRIDGE_JAR ?? "";
  private readonly javaBin = process.env.JAVA_BIN ?? "java";

  isConfigured(): boolean {
    return Boolean(this.jarPath && fs.existsSync(this.jarPath));
  }

  readMppBinary(buffer: Buffer, originalFileName: string): CanonicalSchedulePayload {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Binary .mpp import requires MPXJ_BRIDGE_JAR (see tools/mpxj-json-bridge) and java on PATH.",
      );
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qegpmo-mpp-"));
    const inputPath = path.join(dir, safeName(originalFileName));
    try {
      fs.writeFileSync(inputPath, buffer);
      const res = spawnSync(this.javaBin, ["-jar", this.jarPath, "read", inputPath], {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 180_000,
      });
      if (res.status !== 0) {
        throw new Error(res.stderr || res.stdout || `Java bridge exited ${res.status}`);
      }
      const parsed = JSON.parse(res.stdout ?? "{}") as CanonicalSchedulePayload;
      if (!parsed.tasks || !parsed.links) {
        throw new Error("MPXJ bridge returned invalid payload.");
      }
      return parsed;
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

function safeName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-]+/g, "_");
  return base.endsWith(".mpp") ? base : `${base}.mpp`;
}
