const express = require("express");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const axios = require("axios");

const PORT = process.env.PORT || 8080;

// --- DPI and label size (in PDF points) ---
const INCH_TO_PT = 72;
const LABEL_WIDTH_IN = 4;
const LABEL_HEIGHT_IN = 1.5;
const LABEL_WIDTH_PT = LABEL_WIDTH_IN * INCH_TO_PT;      // 288pt
const LABEL_HEIGHT_PT = LABEL_HEIGHT_IN * INCH_TO_PT;    // 108pt

// PrintNode API key
const PRINTNODE_API_KEY = process.env.PRINTNODE_API_KEY || "YOUR_API_KEY_HERE";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Simple Badge Print API running.");
});

app.post("/print-badge", async (req, res) => {
  try {
    const { firstName, lastName, printerId } = req.body;
    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "GUEST";

    // --- Make PDF: White background, large name ---
    const doc = new PDFDocument({
      size: [LABEL_WIDTH_PT, LABEL_HEIGHT_PT],
      layout: "landscape", // landscape = 4 wide x 1.5 tall
      margin: 0,
    });

    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      // --- Send to PrintNode ---
      try {
        const printJob = await axios.post(
          "https://api.printnode.com/printjobs",
          {
            printer: printerId,
            title: `Badge for ${fullName}`,
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
        console.error("PrintNode error:", printErr?.response?.data || printErr);
        res.status(500).json({
          success: false,
          message: "Error sending to printer",
          detail: printErr?.response?.data || printErr.toString(),
        });
      }
    });

    // --- White background ---
    doc.rect(0, 0, LABEL_WIDTH_PT, LABEL_HEIGHT_PT).fill("#fff");

    // --- Big, bold, centered name ---
    doc
      .fillColor("#000")
      .font("Helvetica-Bold")
      .fontSize(36) // Will fit most names, adjust if you want!
      .text(fullName, 0, 20, {
        width: LABEL_WIDTH_PT,
        align: "center",
        valign: "center",
      });

    doc.end();
  } catch (error) {
    console.error("Badge print error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
