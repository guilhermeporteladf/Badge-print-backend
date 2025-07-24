const express = require("express");
const PDFDocument = require("pdfkit");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PORT = process.env.PORT || 8080;
const PRINTNODE_API_KEY = process.env.PRINTNODE_API_KEY || "GPsPSWkdE5rUGeaW0-Oi50Hlf2EVZbUAx_amI9AJ-Ng";

// Template file for badge background (adjust if your PNG path is different)
const TEMPLATE_PATH = path.join(__dirname, "assets", "Badge Front.png");

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Read printers from env variables (add as many as you want!)
 * You can add COMPUTER1_PRINTER1, COMPUTER1_PRINTER2, etc.
 */
function getComputersAndPrinters() {
  const computers = [];

  // Gather computer variable names (COMPUTER1, COMPUTER2, ...)
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith("COMPUTER")) {
      // e.g. COMPUTER1
      const computerId = process.env[key];
      // find printers for this computer
      const printers = [];
      Object.keys(process.env).forEach((pkey) => {
        if (pkey.startsWith(key + "_PRINTER")) {
          printers.push({
            name: pkey, // or add a label if you want, for now use var name
            id: process.env[pkey],
          });
        }
      });
      computers.push({
        name: key,
        id: computerId,
        printers,
      });
    }
  });
  return computers;
}

const COMPUTERS = getComputersAndPrinters();

app.get("/", (req, res) => {
  res.send("Badge Print API running.");
});

app.get("/computers", (req, res) => {
  // For debugging/testing
  res.json(COMPUTERS);
});

app.post("/print-badge", async (req, res) => {
  try {
    const { firstName, lastName, computer, printerSlot, ticketNumber } = req.body;

    // Find computer
    const comp = COMPUTERS.find(c => c.id === computer || c.name === computer);
    if (!comp) {
      return res.status(400).json({ success: false, message: "Computer not found" });
    }

    // Find printer (by slot, eg. 1, 2, 3... or PRINTER1, etc)
    let printer;
    if (printerSlot !== undefined && printerSlot !== null) {
      // If slot is number: use array index; if string, try to match by name
      if (typeof printerSlot === "number") {
        printer = comp.printers[printerSlot];
      } else if (typeof printerSlot === "string") {
        printer = comp.printers.find(p => p.name === `${comp.name}_PRINTER${printerSlot}`);
      }
    } else {
      printer = comp.printers[0]; // fallback: first printer
    }

    if (!printer) {
      return res.status(400).json({ success: false, message: "Printer not found for this computer" });
    }

    // ---- Generate simple PDF ----
    const LABEL_WIDTH = 1200; // 4 inches at 108 dpi (or 1200 for 300dpi if your label is 1200x450px)
    const LABEL_HEIGHT = 450; // 1.5 inches at 108 dpi

    const doc = new PDFDocument({
      size: [LABEL_WIDTH, LABEL_HEIGHT],
      layout: "landscape",
      margin: 0,
    });

    let buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", async () => {
      const pdfBuffer = Buffer.concat(buffers);

      try {
        // Send PDF to PrintNode
        const printJob = await axios.post(
          "https://api.printnode.com/printjobs",
          {
            printer: printer.id,
            title: `Badge for ${firstName || ""} ${lastName || ""}`,
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

    // Optionally add your template background (uncomment if you want):
    // doc.image(TEMPLATE_PATH, 0, 0, { width: LABEL_WIDTH, height: LABEL_HEIGHT });

    // Print the name in the center
    const fullName = `${firstName || ""} ${lastName || ""}`.trim() || "NAME NAME";
    doc.font("Helvetica-Bold")
      .fontSize(30)
      .fillColor("#000")
      .text(fullName, 0, 40, { width: LABEL_WIDTH, align: "center" });

    doc.end();
  } catch (error) {
    console.error("Badge print error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  console.log("Loaded computers/printers:", JSON.stringify(COMPUTERS, null, 2));
});
