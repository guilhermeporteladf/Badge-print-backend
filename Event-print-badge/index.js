const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Badge Print API running.");
});

app.post("/print-badge", async (req, res) => {
  const { firstName, lastName, ticketNumber } = req.body;

  // 1. Generate PDF
  const doc = new PDFDocument({ size: "A7", margin: 10 });
  let bufs = [];
  doc.fontSize(24).text(`${firstName} ${lastName}`, { align: "center" });
  doc.moveDown();
  doc.fontSize(18).text(`Ticket: ${ticketNumber}`, { align: "center" });
  doc.end();
  for await (const d of doc) bufs.push(d);
  const pdfBuffer = Buffer.concat(bufs);

  // 2. Send to PrintNode
  try {
    const printJob = {
      printerId: parseInt(process.env.PRINTER_ID),
      title: `Badge for ${firstName} ${lastName}`,
      contentType: "pdf_base64",
      content: pdfBuffer.toString("base64"),
      source: "EventManagerWeb"
    };

    const response = await axios.post(
      "https://api.printnode.com/printjobs",
      printJob,
      {
        auth: {
          username: process.env.PRINTNODE_API_KEY,
          password: ""
        }
      }
    );

    res.status(200).json({ success: true, printJobId: response.data.id });
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ error: "Failed to send to PrintNode" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
