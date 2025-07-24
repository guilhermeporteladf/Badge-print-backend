const express = require("express");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PORT = process.env.PORT || 8080;
const TEMPLATE_PATH = path.join(__dirname, "assets", "Badge Front.png"); // Your badge template
const PRINTNODE_API_KEY = process.env.PRINTNODE_API_KEY; // Set this in Railway

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Badge Print API running.");
});

// Helper to get printer IDs for a given computer
function getPrinterId(computerNum, printerNum) {
  // E.g., COMPUTER1_PRINTER2
  return process.env[`COMPUTER${computerNum}_PRINTER${printerNum}`];
}

app.post("/print-badge", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      ticketNumber,
      computerNum,   // 1, 2, or 3
      printerNum,    // 1, 2, or 3
      sessions = [20, 15, 30, 40, 50],
    } = req.body;

    // 4x1.5in @ 300dpi = 1200 x 450 pixels
    const LABEL_WIDTH = 450;
    const LABEL_HEIGHT = 1200;

    // Generate PDF
    const doc = new PDFDocument({
      size: [LABEL_WIDTH, LABEL_HEIGHT],
      layout: "landscape",
      margin: 0,
    });

    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      // Get the printer ID from env vars
      const printerId = getPrinterId(computerNum, printerNum);

      if (!printerId) {
        return res.status(400).json({
          success: false,
          message: `Printer ID for COMPUTER${computerNum}_PRINTER${printerNum} not set.`,
        });
      }

      // ---- SEND PDF to PrintNode ----
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
            auth: {
              username: PRINTNODE_API_KEY,
              password: "",
            },
          }
        );

        res.json({ success: true, printJobId: printJob.data.id });
      } catch (printErr) {
        console.error("Error sending to PrintNode:", printErr?.response?.data || printErr);
        res.status(500).json({
          success: false,
          message: "Error sending to printer",
          detail: printErr?.response?.data || printErr.toString(),
        });
      }
    });

    // Draw badge background
    doc.image(TEMPLATE_PATH, 0, 0, { width: LABEL_WIDTH, height: LABEL_HEIGHT });

    // Print name (centered)
    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "NAME NAME";
    doc.font("Helvetica-Bold")
      .fontSize(120)
      .fillColor("#000")
      .text(fullName, 0, 60, { width: LABEL_WIDTH, align: "center" });

    // Session labels and values (optional)
    const sessionLabelsY = 300;
    doc.font("Helvetica-Bold")
      .fontSize(36)
      .fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 220;
      doc.text(`SESSION ${i + 1}`, x, sessionLabelsY, { width: 180, align: "center" });
    }

    // Session values
    const sessionValuesY = 360;
    doc.font("Helvetica-Bold")
      .fontSize(50)
      .fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 220;
      doc.text(sessions[i] || "", x, sessionValuesY, {
        width: 180,
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
