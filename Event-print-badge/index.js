const express = require("express");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PORT = process.env.PORT || 8080;
const TEMPLATE_PATH = path.join(__dirname, "assets", "Badge-Front.png");
const PRINTNODE_API_KEY = process.env.PRINTNODE_API_KEY || "GPsPSWkdE5rUGeaW0-Oi50Hlf2EVZbUAx_amI9AJ-Ng";

// --- For slot mapping ---
const PRINTERS = {
  COMPUTER1: [
    process.env.COMPUTER1_PRINTER1,
    process.env.COMPUTER1_PRINTER2,
    process.env.COMPUTER1_PRINTER3,
  ],
  COMPUTER2: [
    process.env.COMPUTER2_PRINTER1,
    process.env.COMPUTER2_PRINTER2,
    process.env.COMPUTER2_PRINTER3,
    process.env.COMPUTER2_PRINTER4,
    process.env.COMPUTER2_PRINTER5,
  ],
  COMPUTER3: [
    process.env.COMPUTER3_PRINTER1,
    process.env.COMPUTER3_PRINTER2,
    process.env.COMPUTER3_PRINTER3,
  ],
};

const app = express();
app.use(cors());
app.use(express.json());

app.post("/print-badge", async (req, res) => {
  try {
    const {
      firstName = "",
      lastName = "",
      computer,
      printerSlot = 0,
      sessions = ["", "", ""], // Pass an array of 3 session strings
    } = req.body;

    // PDF LABEL: 4in x 1.5in portrait
    const LABEL_WIDTH = 288;
    const LABEL_HEIGHT = 108;

    const doc = new PDFDocument({
      size: [LABEL_WIDTH, LABEL_HEIGHT],
      layout: "portrait",
      margin: 0,
    });

    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      const printerList = PRINTERS[computer] || [];
      const printerId = printerList[printerSlot];
      if (!printerId) {
        return res.status(400).json({ success: false, message: "No printer found for this slot" });
      }

      try {
        const printJob = await axios.post(
          "https://api.printnode.com/printjobs",
          {
            printer: printerId,
            title: `Badge for ${firstName} ${lastName}`,
            contentType: "pdf_base64",
            content: pdfBuffer.toString("base64"),
            source: "Event Check-In App",
          },
          {
            auth: { username: PRINTNODE_API_KEY, password: "" },
          }
        );

        res.json({ success: true, printJobId: printJob.data.id });
      } catch (printErr) {
        res.status(500).json({
          success: false,
          message: "Error sending to printer",
          detail: printErr?.response?.data || printErr.toString(),
        });
      }
    });

    // Draw PNG background if needed
    if (fs.existsSync(TEMPLATE_PATH)) {
      doc.image(TEMPLATE_PATH, 0, 0, { width: LABEL_WIDTH, height: LABEL_HEIGHT });
    }

    // Name (top, centered)
    const fullName = `${firstName} ${lastName}`.trim() || "NAME NAME";
    doc.font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#000")
      .text(fullName, 0, 12, { width: LABEL_WIDTH, align: "center" });

    // Sessions: 3 rows, centered under name
    doc.font("Helvetica")
      .fontSize(17)
      .fillColor("#222");

    // Calculate base Y so all 3 sessions are nicely spaced below the name
    let sessionBaseY = 45;
    for (let i = 0; i < 3; i++) {
      doc.text(sessions[i] || "", 0, sessionBaseY + i * 21, {
        width: LABEL_WIDTH,
        align: "center",
      });
    }

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
