const express = require("express");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const router = express.Router();

router.post("/print-badge", async (req, res) => {
  const { firstName, lastName, sessions = [20, 15, 30, 40, 50] } = req.body; // sessions: array of numbers

  // Path to your PNG template
  const badgeTemplatePath = path.join(__dirname, "assets", "Badge Front.png");

  try {
    // Setup PDF document
    const doc = new PDFDocument({
      size: [1200, 450], // px, matches your PNG
      margin: 0,
    });

    // Buffer for PDF output
    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      res.contentType("application/pdf");
      res.send(pdfData);
    });

    // Draw background template
    doc.image(badgeTemplatePath, 0, 0, { width: 1200, height: 450 });

    // Draw name in the center (tweak y for perfect alignment)
    doc.font("Helvetica-Bold")
      .fontSize(130)
      .fillColor("black")
      .text(
        `${firstName} ${lastName}`,
        0,
        70, // adjust as needed
        { align: "center", width: 1200 }
      );

    // Draw sessions (titles and values)
    const sessionTitles = ["SESSION 1", "SESSION 2", "SESSION 3", "SESSION 4", "SESSION 5"];
    const sessionY = 200;
    const valueY = 320;
    const xPositions = [160, 355, 555, 755, 955]; // tweak if needed

    doc.font("Helvetica-Bold").fontSize(34);

    sessionTitles.forEach((title, i) => {
      doc.text(title, xPositions[i] - 65, sessionY, { width: 130, align: "center" });
    });

    doc.fontSize(60).font("Helvetica-Bold");
    sessions.forEach((val, i) => {
      doc.text(`${val}`, xPositions[i] - 65, valueY, {
        width: 130,
        align: "center",
        underline: true,
      });
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to generate badge");
  }
});

module.exports = router;
