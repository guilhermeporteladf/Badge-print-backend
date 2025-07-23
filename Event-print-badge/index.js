const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Set your asset path
const TEMPLATE_PATH = path.join(__dirname, "assets", "Badge Front.png");

// Helper to print badge
app.post("/print-badge", async (req, res) => {
  try {
    const { firstName, lastName, ticketNumber, printerId } = req.body;
    if (!firstName || !lastName || !ticketNumber || !printerId) {
      return res.status(400).json({ error: "Missing data" });
    }

    // PDF sizes (points): 1 inch = 72 pts; so 4x1.5 in = 288 x 108 pts
    const width = 288;
    const height = 108;

    // Create PDF
    const doc = new PDFDocument({
      size: [width, height],
      layout: "landscape", // Ensures horizontal
      margin: 0,
    });

    let bufs = [];
    doc.on("data", (d) => bufs.push(d));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(bufs);
      console.log("PDF size:", (pdfBuffer.length / 1024).toFixed(1), "KB");

      // PrintNode job
      try {
        const printJob = {
          printerId: Number(printerId),
          title: `Badge for ${firstName} ${lastName}`,
          contentType: "pdf_base64",
          content: pdfBuffer.toString("base64"),
          source: "EventManagerWeb",
        };

        const response = await axios.post(
          "https://api.printnode.com/printjobs",
          printJob,
          {
            auth: {
              username: process.env.PRINTNODE_API_KEY,
              password: "",
            },
          }
        );

        res.json({ success: true, printJobId: response.data.id });
      } catch (e) {
        console.error(e?.response?.data || e.message);
        res.status(500).json({ error: "Failed to send to PrintNode" });
      }
    });

    // Draw the PNG template (make sure PNG exists and is small)
    if (fs.existsSync(TEMPLATE_PATH)) {
      doc.image(TEMPLATE_PATH, 0, 0, { width: width, height: height });
    } else {
      console.error("Template PNG not found at", TEMPLATE_PATH);
    }

    // Draw text (adjust Y for best look)
    doc.font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#000")
      .text(`${firstName} ${lastName}`, 0, 28, {
        align: "center",
        width: width,
      });

    // Draw ticket number (smaller)
    doc.font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#000")
      .text(ticketNumber, 0, height - 36, {
        align: "center",
        width: width,
      });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  }
});

// Start server if not in serverless
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Badge print backend running on port ${PORT}`);
  });
}

module.exports = app;
