const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/print-badge", async (req, res) => {
  const { firstName, lastName, ticketNumber, printerId } = req.body;
  if (!firstName || !lastName || !ticketNumber || !printerId) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // Set page to 4 x 1.5 inches, landscape
    const doc = new PDFDocument({
      size: [288, 108], // width x height in points
      layout: "landscape",
      margin: 0
    });

    let bufs = [];

    // Draw template
    doc.image(
      path.join(__dirname, "assets", "Badge Front.png"),
      0,
      0,
      { width: 288, height: 108 }
    );

    // Print name and ticket number, centered
    doc.fontSize(28)
      .fillColor("#000")
      .font("Helvetica-Bold")
      .text(`${firstName} ${lastName}`, 0, 40, {
        width: 288,
        align: "center"
      });

    doc.fontSize(14)
      .fillColor("#000")
      .font("Helvetica")
      .text(`Ticket: ${ticketNumber}`, 0, 75, {
        width: 288,
        align: "center"
      });

    doc.end();

    for await (const d of doc) bufs.push(d);
    const pdfBuffer = Buffer.concat(bufs);

    // Send to PrintNode
    const response = await axios.post(
      "https://api.printnode.com/printjobs",
      {
        printerId,
        title: `Badge for ${firstName} ${lastName}`,
        contentType: "pdf_base64",
        content: pdfBuffer.toString("base64"),
        source: "EventManagerWeb"
      },
      {
        auth: {
          username: process.env.PRINTNODE_API_KEY,
          password: ""
        }
      }
    );

    res.json({ success: true, printJobId: response.data.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to print badge" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Badge print backend running on port " + PORT);
});
