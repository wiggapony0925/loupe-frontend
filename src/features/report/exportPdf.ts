/**
 * Generates a printable HTML version of a ForensicReport and hands it to
 * `expo-print` to produce a PDF, then opens the system share sheet via
 * `expo-sharing` so the user can save / send / AirDrop it.
 */
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { ForensicReport } from "@/types/domain";

export async function exportReportPdf(report: ForensicReport) {
  const html = renderReportHtml(report);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Loupe report · ${report.card.title}`,
      UTI: "com.adobe.pdf",
    });
  }
  return uri;
}

function renderReportHtml(report: ForensicReport): string {
  const { card, score, dings, source, priceHistory } = report;
  const dingRows = dings
    .map(
      (d) =>
        `<tr><td>${d.category}</td><td>${(d.severity * 100).toFixed(0)}%</td><td>${d.x.toFixed(2)}, ${d.y.toFixed(2)}</td></tr>`,
    )
    .join("");
  const priceRows = (priceHistory ?? [])
    .map(
      (p) =>
        `<tr><td>${p.date}</td><td>$${p.priceUsd.toLocaleString()}</td><td>${p.venue ?? ""}</td></tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Loupe Report ${card.id}</title>
<style>
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif}
  body{margin:0;padding:32px;background:#0B0B0D;color:#F5F5F7}
  .eyebrow{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#6E6E73}
  h1{font-size:28px;margin:4px 0 24px;font-weight:600}
  .grade{display:inline-block;padding:18px 28px;border-radius:18px;background:#00F59B;color:#0B0B0D;font-size:48px;font-weight:700}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px}
  .card{padding:16px;border:1px solid #2A2A2E;border-radius:16px;background:#1C1C1E}
  .label{color:#A1A1A6;font-size:11px;letter-spacing:2px;text-transform:uppercase}
  .value{font-size:22px;font-weight:600;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
  th,td{text-align:left;padding:8px 6px;border-bottom:1px solid #2A2A2E}
  th{color:#A1A1A6;text-transform:uppercase;letter-spacing:2px;font-size:10px}
  .images{display:flex;gap:12px;margin-top:24px}
  .images img{flex:1;width:48%;border-radius:12px;border:1px solid #2A2A2E}
  .footer{margin-top:32px;padding-top:16px;border-top:1px solid #2A2A2E;font-size:10px;color:#6E6E73}
</style></head><body>
  <div class="eyebrow">Loupe · Forensic Report</div>
  <h1>${card.title}</h1>
  <div class="eyebrow">${card.set} · ${card.year}</div>
  <div style="margin-top:24px"><div class="grade">${score.grade.toFixed(1)}</div></div>
  <div class="grid">
    <div class="card"><div class="label">Surface</div><div class="value">${score.surface}</div></div>
    <div class="card"><div class="label">Edges</div><div class="value">${score.edges}</div></div>
    <div class="card"><div class="label">Corners</div><div class="value">${score.corners}</div></div>
    <div class="card"><div class="label">Centering</div><div class="value">${score.centering}</div></div>
  </div>
  <div class="card" style="margin-top:16px"><div class="label">Composite</div><div class="value">${score.composite} / 1000</div></div>
  <div class="images">
    <img src="${card.thumbnailUri}" alt="Front" />
    <img src="${card.thumbnailUri}" alt="Back" />
  </div>
  <h2 style="margin-top:32px;font-size:14px;letter-spacing:2px;text-transform:uppercase;color:#A1A1A6">DINGS</h2>
  <table><thead><tr><th>Category</th><th>Severity</th><th>Position (x,y)</th></tr></thead><tbody>${dingRows}</tbody></table>
  ${
    priceRows
      ? `<h2 style="margin-top:32px;font-size:14px;letter-spacing:2px;text-transform:uppercase;color:#A1A1A6">Sold Comps</h2>
         <table><thead><tr><th>Date</th><th>Price</th><th>Venue</th></tr></thead><tbody>${priceRows}</tbody></table>`
      : ""
  }
  <div class="footer">
    Capture source: ${source ?? "scanner"} · Captured ${new Date(report.capturedAt).toLocaleString()}<br/>
    Report ID: ${report.id}
  </div>
</body></html>`;
}
