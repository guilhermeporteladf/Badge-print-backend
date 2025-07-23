const express = require("express");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PORT = process.env.PORT || 8080;
const TEMPLATE_PATH = path.join(__dirname, "assets", "Badge Front.png"); // PNG must match label aspect ratio!
const PRINTNODE_API_KEY = process.env.PRINTNODE_API_KEY || "REPLACE_WITH_YOUR_KEY"; // <<<--- SET THIS

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
      sessions = [20, 15, 30, 40, 50],
    } = req.body;

    // Label at 4in x 1.5in, 300 DPI
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

    // Draw PNG background (must be 1200x450 for perfect fit)
    doc.image(TEMPLATE_PATH, 0, 0, { width: LABEL_WIDTH, height: LABEL_HEIGHT });

    // Name (centered)
    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "NAME NAME";
    doc.font("Helvetica-Bold")
      .fontSize(200)
      .fillColor("#000")
      .text(fullName, 0, 60, { width: LABEL_WIDTH, align: "center" });

    // Session labels and values
    const sessionLabelsY = 300;
    doc.font("Helvetica-Bold")
      .fontSize(54)
      .fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 150 + i * 180;
      doc.text(`SESSION ${i + 1}`, x, sessionLabelsY, { width: 180, align: "center" });
    }

    // Session values
    const sessionValuesY = 375;
    doc.font("Helvetica-Bold")
      .fontSize(80)
      .fillColor("#000");
    for (let i = 0; i < 5; i++) {
      const x = 150 + i * 180;
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
