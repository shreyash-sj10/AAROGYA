const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function toSafeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toSafeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toSafeNumber(value, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function formatDateUtc(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveWritablePath(requestedPath) {
  const safeRequested = toSafeString(requestedPath, "/mnt/data/aarogya_week_plan.pdf");

  if (safeRequested.startsWith("/")) {
    return path.resolve(process.cwd(), `.${safeRequested}`);
  }

  return path.resolve(process.cwd(), safeRequested);
}

function buildDateRange(weekPlan) {
  const safePlan = toSafeObject(weekPlan);
  const days = Array.isArray(safePlan.week_plan) ? safePlan.week_plan.length : 0;
  const today = new Date();
  const end = new Date(today.getTime());
  end.setUTCDate(end.getUTCDate() + Math.max(0, days - 1));

  return `${formatDateUtc(today)} to ${formatDateUtc(end)}`;
}

function escapePdfText(value) {
  return toSafeString(value, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function writeFallbackPdf(outputPath, payload) {
  const weekPlan = toSafeObject(payload.weekPlan);
  const adherence = toSafeObject(payload.adherence);
  const optimization = toSafeObject(payload.optimization);
  const before = toSafeObject(toSafeObject(optimization.before).weekly_totals);
  const after = toSafeObject(toSafeObject(optimization.after).weekly_totals);
  const stats = toSafeObject(adherence.stats);

  const lines = [
    "AAROGYA Weekly Plan",
    `Date Range: ${toSafeString(payload.dateRange, "N/A")}`,
    `Days: ${toSafeArray(weekPlan.week_plan).length}`,
    "Optimization Summary:",
    `Before Calories: ${toSafeNumber(before.calories, 0).toFixed(2)}`,
    `After Calories: ${toSafeNumber(after.calories, 0).toFixed(2)}`,
    "Adherence Summary:",
    `Score: ${toSafeNumber(adherence.adherence_score, 0).toFixed(4)}`,
    `Followed: ${Math.max(0, Math.trunc(toSafeNumber(stats.meals_followed, 0)))}`,
    `Skipped: ${Math.max(0, Math.trunc(toSafeNumber(stats.meals_skipped, 0)))}`,
    `Modified: ${Math.max(0, Math.trunc(toSafeNumber(stats.meals_modified, 0)))}`,
    `Deterministic: ${toSafeString(payload.deterministic_explanation, "")}`,
  ];

  const textOps = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
  ];

  lines.forEach((line, index) => {
    if (index === 0) {
      textOps.push(`(${escapePdfText(line)}) Tj`);
    } else {
      textOps.push("0 -18 Td");
      textOps.push(`(${escapePdfText(line)}) Tj`);
    }
  });

  textOps.push("ET");

  const content = textOps.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content, "utf8")} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer << /Root 1 0 R /Size ${objects.length + 1} >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  fs.writeFileSync(outputPath, pdf, "utf8");
}

function generateWeeklyPDF(weekPlan, adherence, optimization, options = {}) {
  const safeOptions = toSafeObject(options);
  const requestedPath = toSafeString(safeOptions.output_path, "/mnt/data/aarogya_week_plan.pdf");
  const outputPath = resolveWritablePath(requestedPath);
  const outputDir = path.dirname(outputPath);
  const tmpPayloadPath = path.join(outputDir, "weekly_pdf_payload.json");
  const scriptPath = path.resolve(process.cwd(), "src/modules/export/reportlab_weekly_pdf.py");

  fs.mkdirSync(outputDir, { recursive: true });

  const payload = {
    weekPlan: toSafeObject(weekPlan),
    adherence: toSafeObject(adherence),
    optimization: toSafeObject(optimization),
    userInfo: toSafeObject(safeOptions.user_info),
    dateRange: toSafeString(safeOptions.date_range, buildDateRange(weekPlan)),
    deterministic_explanation: toSafeString(
      safeOptions.deterministic_explanation,
      "Weekly plan optimized via deterministic quantity scaling with strict safety bounds."
    ),
    ai_explanation: toSafeString(safeOptions.ai_explanation, ""),
  };

  fs.writeFileSync(tmpPayloadPath, JSON.stringify(payload, null, 2), "utf8");

  const commandResult = spawnSync(
    "python",
    [scriptPath, tmpPayloadPath, outputPath],
    { encoding: "utf8" }
  );

  if (commandResult.status !== 0) {
    writeFallbackPdf(outputPath, payload);
  }

  if (!fs.existsSync(outputPath)) {
    throw new Error("PDF generation completed without output file.");
  }

  return {
    file_path: outputPath,
    requested_path: requestedPath,
    download_link: outputPath,
    renderer: commandResult.status === 0 ? "reportlab" : "deterministic_fallback",
  };
}

module.exports = {
  generateWeeklyPDF,
};
