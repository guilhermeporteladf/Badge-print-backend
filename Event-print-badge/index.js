const express = require("express");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PORT = process.env.PORT || 8080;
const TEMPLATE_PATH = path.join(__dirname, "assets", "Badge Front.png");
const PRINTNODE_API_KEY = process.env.PRINTNODE_API_KEY || "GPsPSWkdE5rUGeaW0-Oi50Hlf2EVZbUAx_amI9AJ-Ng";
const COMPUTER_ID = process.env.COMPUTER_ID || "670914"; // <--- CHANGE PER DEPLOYMENT

// ==== Define printers per computer ====
// Fill in your printer IDs for each computer here
const COMPUTER_PRINTERS = {
  "670914": [74545334, 74545335, 74545337], // Desk 1 (LAPTOP-527PLVBB)
  "671077": [74545189, 74545197, 74545194, 74545190, 74573362], // Desk 2 (DESKTOP-OET8SVD)
  "DESK3ID": [12345678, 12345679, 12345680], // Desk 3 (Update with real ID/printers)
  // Add more computers if needed
};

// Used for round-robin
let printerCounter = 0;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Badge Print API running.");
});

app.post("/print-badge", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      ticketNumber,
      sessions = [20, 15, 30, 40, 50],
      // Optional: printerId (for manual override)
      printerId,
    } = req.body;

    // ---- Pick printer (auto if not provided) ----
    const printers = COMPUTER_PRINTERS[COMPUTER_ID];
    if (!printers || printers.length === 0) {
      return res.status(500).json({ success: false, message: "No printers configured for this computer." });
    }
    let selectedPrinter = printerId || printers[printerCounter % printers.length];
    printerCounter = (printerCounter + 1) % printers.length;

    // ---- PDF GENERATION ----
    // Label at 4in x 1.5in, 300 DPI = 1200 x 450 px
    const LABEL_WIDTH = 1200;
    const LABEL_HEIGHT = 450;

    const doc = new PDFDocument({
      size: [LABEL_WIDTH, LABEL_HEIGHT],
      layout: "landscape",
      margin: 0,
    });

    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      // ---- SEND PDF to PrintNode ----
      try {
        const printJob = await axios.post(
          "https://api.printnode.com/printjobs",
          {
            printer: selectedPrinter,
            title: `Badge for ${firstName} ${lastName}`,
            contentType: "pdf_base64",
            content: pdfBuffer.toString("base64"),
            source: `Event Check-In (${COMPUTER_ID})`,
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

    // Draw PNG background (must be 1200x450 for perfect fit)
    doc.image(TEMPLATE_PATH, 0, 0, { width: LABEL_WIDTH, height: LABEL_HEIGHT });

    // Name (centered, adjust size if needed)
    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "NAME NAME";
    doc.font("Helvetica-Bold")
      .fontSize(120) // 120 for landscape, adjust if you want bigger/smaller
      .fillColor("#000")
      .text(fullName, 0, 40, { width: LABEL_WIDTH, align: "center" });

    // Sessions (same as before)
    const sessionLabelsY = 230;
    doc.font("Helvetica-Bold").fontSize(32).fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 100 + i * 200;
      doc.text(`SESSION ${i + 1}`, x, sessionLabelsY, { width: 200, align: "center" });
    }

    const sessionValuesY = 285;
    doc.font("Helvetica-Bold").fontSize(60).fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 100 + i * 200;
      doc.text(sessions[i] || "", x, sessionValuesY, {
        width: 200,
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
  console.log(`Server running on ${PORT}. COMPUTER_ID=${COMPUTER_ID}`);
});
