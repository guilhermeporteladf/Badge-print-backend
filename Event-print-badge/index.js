const express = require("express");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PORT = process.env.PORT || 8080;
const TEMPLATE_PATH = path.join(__dirname, "assets", "Badge Front.png"); // PNG must be 288x108 px
const PRINTNODE_API_KEY = process.env.PRINTNODE_API_KEY || "REPLACE_WITH_YOUR_KEY"; // <<<--- SET THIS!

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
      printerId,
      sessions = [20, 15, 30, 40, 50], // Default for demo
    } = req.body;

    // Create badge as PDF (landscape, 4x1.5in @ 72dpi)
    const LABEL_WIDTH = 288;
    const LABEL_HEIGHT = 108;

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

    // Draw PNG background
    doc.image(TEMPLATE_PATH, 0, 0, { width: LABEL_WIDTH, height: LABEL_HEIGHT });

    // Name
    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "NAME NAME";
    doc.font("Helvetica-Bold")
      .fontSize(40)
      .fillColor("#000")
      .text(fullName, 0, 18, { width: LABEL_WIDTH, align: "center" });

    // Session labels
    const sessionLabelsY = 60;
    doc.font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 36 + i * 48;
      doc.text(`SESSION ${i + 1}`, x, sessionLabelsY, { width: 48, align: "center" });
    }

    // Session values (underlined)
    const sessionValuesY = 82;
    doc.font("Helvetica-Bold")
      .fontSize(28)
      .fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 36 + i * 48;
      doc.text(sessions[i] || "", x, sessionValuesY, {
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
