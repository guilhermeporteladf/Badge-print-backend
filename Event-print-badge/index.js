const express = require("express");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

// --- CONFIG ---
const PORT = process.env.PORT || 8080;
const TEMPLATE_PATH = path.join(__dirname, "assets", "Badge Front.png"); // Must be 288x108 px

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Badge Print API running.");
});

app.post("/print-badge", async (req, res) => {
  try {
    const { firstName, lastName, ticketNumber, printerId, sessions = [] } = req.body;

    // 4 x 1.5 inch label at 72 DPI (landscape)
    const LABEL_WIDTH = 288;
    const LABEL_HEIGHT = 108;

    // Create the PDF
    const doc = new PDFDocument({
      size: [LABEL_WIDTH, LABEL_HEIGHT],
      layout: 'landscape',
      margin: 0,
    });

    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', async () => {
      const pdfBuffer = Buffer.concat(buffers);

      // ---- SEND TO PRINTER NODE (your logic, e.g., via axios) ----
      // For now just return the PDF buffer for testing:
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="badge.pdf"',
      });
      res.send(pdfBuffer);
    });

    // Draw background template
    doc.image(TEMPLATE_PATH, 0, 0, { width: LABEL_WIDTH, height: LABEL_HEIGHT });

    // ---- Name (big and centered) ----
    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "NAME NAME";
    doc.font("Helvetica-Bold")
      .fontSize(40)
      .fillColor("#000")
      .text(fullName, 0, 18, { width: LABEL_WIDTH, align: "center" });

    // ---- Sessions (centered, spaced below name) ----
    const sessionsArray = Array.isArray(sessions) && sessions.length === 5
      ? sessions
      : [20, 15, 30, 40, 50]; // Demo default

    // Draw SESSION LABELS
    const sessionLabelsY = 60;
    doc.font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 36 + i * 48;
      doc.text(`SESSION ${i + 1}`, x, sessionLabelsY, { width: 48, align: "center" });
    }

    // Draw SESSION VALUES (underlined)
    const sessionValuesY = 82;
    doc.font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 36 + i * 48;
      doc.text(sessionsArray[i], x, sessionValuesY, {
        width: 48,
        align: "center",
        underline: true,
      });
    }

    doc.end();
  } catch (error) {
    console.error("Badge print error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
