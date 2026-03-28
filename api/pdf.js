import PDFDocument from "pdfkit";

export const config = {
  api: {
    bodyParser: true
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: "Missing data" });
    }

    const doc = new PDFDocument({ margin: 50 });

    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=sitepilot-report.pdf"
      );

      res.status(200).send(pdfBuffer);
    });

    // ======================
    // CONTENT
    // ======================

    doc.fontSize(24).text("SitePilot Report", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Website: ${data.url}`);
    doc.text(`Score: ${data.score}/100`);
    doc.moveDown();

    doc.fontSize(16).text("Scan Data");
    doc.moveDown(0.5);

    doc.fontSize(12).text(`Title: ${data.scanData.title || "None"}`);
    doc.text(`Meta: ${data.scanData.metaDescription || "None"}`);
    doc.text(`H1: ${data.scanData.h1 || "None"}`);
    doc.moveDown();

    doc.fontSize(16).text("Issues");
    doc.moveDown(0.5);

    if (data.issues && data.issues.length) {
      data.issues.forEach((issue, i) => {
        doc.text(`${i + 1}. ${issue}`);
      });
    } else {
      doc.text("No issues found");
    }

    doc.moveDown();

    doc.fontSize(16).text("AI Feedback");
    doc.moveDown(0.5);

    if (data.feedback && data.feedback.length) {
      data.feedback.forEach((item, i) => {
        doc.text(`${i + 1}. ${item}`);
        doc.moveDown(0.5);
      });
    }

    doc.end();
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
