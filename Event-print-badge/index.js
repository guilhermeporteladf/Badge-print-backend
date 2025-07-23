const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post("/print-badge", async (req, res) => {
  try {
    const { firstName, lastName, ticketNumber, printerId } = req.body;
    if (!firstName || !lastName || !ticketNumber || !printerId) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // === 1. Generate PDF with template, LANDSCAPE ===
    const doc = new PDFDocument({
      size: [1200, 450], // 4" x 1.5" LANDSCAPE
      margin: 0,
    });
    let bufs = [];

    // For debugging: draw a red border
    doc
      .rect(0, 0, 1200, 450)
      .lineWidth(10)
      .strokeColor("red")
      .stroke();

    // Add template as background image
    const templatePath = path.join(__dirname, "assets", "Badge Front.png");
    doc.image(templatePath, 0, 0, { width: 1200, height: 450 });

    // Add attendee name (center)
    doc
      .fontSize(120)
      .font("Helvetica-Bold")
      .fillColor("black")
      .text(`${firstName} ${lastName}`, 0, 110, {
        width: 1200,
        align: "center",
      });

    // Optionally, ticket number
    doc
      .fontSize(50)
      .font("Helvetica-Bold")
      .fillColor("#333")
      .text(`Ticket: ${ticketNumber}`, 0, 260, {
        width: 1200,
        align: "center",
      });

    doc.end();
    for await (const d of doc) bufs.push(d);
    const pdfBuffer = Buffer.concat(bufs);

    // === 2. Send to PrintNode ===
    const printJob = {
      printerId: parseInt(printerId),
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

    res.status(200).json({ success: true, printJobId: response.data.id });
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ error: "Failed to print badge", details: e.message });
  }
});

app.get("/", (req, res) => {
  res.send("Badge printing backend is running!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
