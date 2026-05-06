import { BadRequestException, Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import PptxGenJS from "pptxgenjs";
import { WeeklyStatusExportFormat } from "@prisma/client";
import { CollectedMetrics, StatusReportEditorContent } from "./status-report.types";

export interface ExportArtifact {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

@Injectable()
export class StatusReportExportService {
  async render(format: WeeklyStatusExportFormat, reportingWeek: string, scopeLabel: string, metrics: CollectedMetrics, editor: StatusReportEditorContent): Promise<ExportArtifact> {
    const safeWeek = reportingWeek.replace(/[^\w-]/g, "");
    switch (format) {
      case "XLSX":
        return {
          buffer: await this.buildExcel(reportingWeek, scopeLabel, metrics, editor),
          fileName: `weekly-status-${safeWeek}.xlsx`,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        };
      case "PDF":
        return {
          buffer: await this.buildPdf(reportingWeek, scopeLabel, metrics, editor),
          fileName: `weekly-status-${safeWeek}.pdf`,
          mimeType: "application/pdf",
        };
      case "PPTX":
        return {
          buffer: await this.buildPptx(reportingWeek, scopeLabel, metrics, editor),
          fileName: `weekly-status-${safeWeek}.pptx`,
          mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        };
      default:
        throw new BadRequestException("Unsupported export format.");
    }
  }

  private async buildExcel(reportingWeek: string, scopeLabel: string, metrics: CollectedMetrics, editor: StatusReportEditorContent): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "QEGPMO";
    const ws = wb.addWorksheet("Weekly Status", { views: [{ state: "frozen", ySplit: 1 }] });

    ws.columns = [
      { header: "Section", key: "section", width: 28 },
      { header: "Content", key: "content", width: 90 },
    ];
    ws.addRows([
      { section: "Reporting week", content: reportingWeek },
      { section: "Scope", content: scopeLabel },
      { section: "Overall RAG (deterministic)", content: metrics.overallRag },
      { section: "Executive summary", content: editor.executiveSummary },
      { section: "Schedule summary", content: editor.scheduleSummary },
      { section: "Cost summary", content: editor.costSummary },
      { section: "Backend schedule metrics", content: JSON.stringify(metrics.schedule) },
      { section: "Backend financial metrics", content: JSON.stringify(metrics.financial) },
      { section: "Backend RIC metrics", content: JSON.stringify(metrics.ric) },
      { section: "Provenance", content: metrics.provenance.join("; ") },
      { section: "Facts digest (SHA-256)", content: metrics.factsDigest },
    ]);

    editor.accomplishments.forEach((line, i) => ws.addRow({ section: `Accomplishment ${i + 1}`, content: line }));
    editor.upcomingMilestones.forEach((line, i) => ws.addRow({ section: `Milestone ${i + 1}`, content: line }));
    editor.topRisks.forEach((r, i) =>
      ws.addRow({
        section: `Risk ${i + 1}`,
        content: `${r.title} (${r.severity}) — ${r.mitigationSummary}`,
      }),
    );

    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  private async buildPdf(reportingWeek: string, scopeLabel: string, metrics: CollectedMetrics, editor: StatusReportEditorContent): Promise<Buffer> {
    return await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      doc.fontSize(18).text(`Weekly Status Report — ${reportingWeek}`, { underline: true });
      doc.moveDown();
      doc.fontSize(11).text(scopeLabel);
      doc.fontSize(10).text(`Overall health (deterministic): ${metrics.overallRag}`);
      doc.moveDown();
      doc.fontSize(12).text("Executive summary");
      doc.fontSize(10).text(editor.executiveSummary, { align: "left" });
      doc.moveDown();
      doc.fontSize(12).text("Schedule");
      doc.fontSize(10).text(editor.scheduleSummary);
      doc.moveDown();
      doc.fontSize(12).text("Cost");
      doc.fontSize(10).text(editor.costSummary);
      doc.moveDown();
      doc.fontSize(12).text("Accomplishments");
      editor.accomplishments.forEach((a) => doc.fontSize(10).text(`• ${a}`, { indent: 10 }));
      doc.moveDown();
      doc.fontSize(12).text("Upcoming milestones");
      editor.upcomingMilestones.forEach((m) => doc.fontSize(10).text(`• ${m}`, { indent: 10 }));
      doc.moveDown();
      doc.fontSize(12).text("Top risks");
      editor.topRisks.forEach((r) =>
        doc.fontSize(10).text(`• ${r.title} (${r.severity}) — ${r.mitigationSummary}`, { indent: 10 }),
      );
      doc.moveDown();
      doc.fontSize(9).fillColor("#444444").text(`Audit digest: ${metrics.factsDigest}`, { align: "left" });
      doc.fillColor("#000000");
      doc.end();
    });
  }

  private async buildPptx(reportingWeek: string, scopeLabel: string, metrics: CollectedMetrics, editor: StatusReportEditorContent): Promise<Buffer> {
    const pptx = new PptxGenJS();
    pptx.author = "QEGPMO";
    pptx.title = `Weekly Status ${reportingWeek}`;

    const title = pptx.addSlide();
    title.addText(`Weekly Status Report`, { x: 0.5, y: 1.2, fontSize: 28, bold: true });
    title.addText(`${reportingWeek} — ${scopeLabel}`, { x: 0.5, y: 2, fontSize: 16 });
    title.addText(`Overall RAG (deterministic): ${metrics.overallRag}`, { x: 0.5, y: 2.6, fontSize: 14 });

    const exec = pptx.addSlide();
    exec.addText("Executive summary", { x: 0.5, y: 0.4, fontSize: 20, bold: true });
    exec.addText(editor.executiveSummary, { x: 0.5, y: 1, w: 9, fontSize: 12 });

    const perf = pptx.addSlide();
    perf.addText("Schedule & cost", { x: 0.5, y: 0.4, fontSize: 20, bold: true });
    perf.addText(editor.scheduleSummary, { x: 0.5, y: 1, w: 9, fontSize: 12 });
    perf.addText(editor.costSummary, { x: 0.5, y: 2.8, w: 9, fontSize: 12 });

    const acc = pptx.addSlide();
    acc.addText("Accomplishments & milestones", { x: 0.5, y: 0.4, fontSize: 20, bold: true });
    acc.addText(
      `Accomplishments:\n${editor.accomplishments.map((a) => `• ${a}`).join("\n")}\n\nUpcoming milestones:\n${editor.upcomingMilestones.map((m) => `• ${m}`).join("\n")}`,
      { x: 0.5, y: 1, w: 9, fontSize: 11 },
    );

    const risks = pptx.addSlide();
    risks.addText("Top risks", { x: 0.5, y: 0.4, fontSize: 20, bold: true });
    risks.addText(editor.topRisks.map((r) => `• ${r.title} (${r.severity}) — ${r.mitigationSummary}`).join("\n"), {
      x: 0.5,
      y: 1,
      w: 9,
      fontSize: 11,
    });

    const audit = pptx.addSlide();
    audit.addText("Auditability", { x: 0.5, y: 0.4, fontSize: 20, bold: true });
    audit.addText(metrics.provenance.join("\n"), { x: 0.5, y: 1, w: 9, fontSize: 10 });
    audit.addText(`Facts digest: ${metrics.factsDigest}`, { x: 0.5, y: 3.5, w: 9, fontSize: 10 });

    const out = await pptx.write({ outputType: "nodebuffer" });
    return out as Buffer;
  }
}
