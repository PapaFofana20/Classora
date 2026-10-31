/**
 * PDF Utility for generating timetable exports
 * Uses PDFKit to generate professional-looking PDF files
 */

import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";
import { unlinkSync } from "fs";
import path from "path";

/**
 * Generate a PDF from timetable data and slots
 * @param {Object} timetable - Timetable metadata
 * @param {Array} slots - Array of timetable slot objects
 * @returns {Buffer} - PDF buffer
 */
export async function generatePdfFromTimetable(timetable, slots) {
  return new Promise((resolve, reject) => {
    const buffers = [];
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
    });

    // Collect data into buffers
    doc.on("data", chunk => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    // Setup page
    let pageNumber = 0;

    // Header
    doc.fontSize(20).text("ÉMÉLÉ DU TEMPS", { align: "center" });
    doc.fontSize(12).text(`École: ${timetable.school_id ? "—" : timetable.title}`, { align: "center" });
    doc.fontSize(12).text(`Classe: ${timetable.grade_level || "Non spécifié"}`, { align: "center" });
    doc.fontSize(12).text(`Période: ${timetable.period_type}`, { align: "center" });
    doc.fontSize(12).text(`Statut: ${timetable.status.toUpperCase()}`, { align: "center" });
    doc.moveDown(2);

    // Timetable info
    doc.fontSize(10).text(`Créé le: ${new Date(timetable.created_at).toLocaleDateString()}`);
    if (timetable.published_at) {
      doc.text(`Publié le: ${new Date(timetable.published_at).toLocaleDateString()}`);
    }
    doc.moveDown(2);

    // Table headers
    const columnWidths = [25, 80, 80, 80, 80, 80]; // Day, Start, End, Subject, Teacher, Room
    const headers = ["Jour", "Début", "Fin", "Matière", "Enseignant", "Salle"];

    // Draw table header
    doc.fontSize(9);
    doc.fillColor("#ffffff");
    doc.strokeColor("#cccccc");
    doc.lineWidth(0.5);

    let xStart = 50;
    let yStart = doc.y;

    headers.forEach((header, i) => {
      const x = xStart + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.rect(x, yStart, columnWidths[i], 25).fillAndStroke();
      doc.text(header, x + 5, yStart + 5, { width: columnWidths[i] - 10 });
    });

    yStart = yStart + 25;

    // Draw table rows
    const dayNames = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

    slots.forEach((slot, index) => {
      // Start new page if needed (every 50 rows)
      if (index > 0 && index % 50 === 0) {
        doc.addPage();
        yStart = doc.y;
        // Redraw headers
        doc.fontSize(9);
        doc.fillColor("#ffffff");
        doc.strokeColor("#cccccc");
        doc.lineWidth(0.5);

        headers.forEach((header, i) => {
          const x = 50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
          doc.rect(50, yStart, columnWidths[i], 25).fillAndStroke();
          doc.text(header, 55, yStart + 5, { width: columnWidths[i] - 10 });
        });

        yStart = yStart + 25;
      }

      const dayIdx = slot.day_of_week; // 0=Monday, etc.
      const dayName = dayNames[dayIdx] || "Inconnu";

      const rowData = [
        dayName,
        slot.start_time.strftime("%H:%M"),
        slot.end_time.strftime("%H:%M"),
        slot.subject || "Non spécifié",
        slot.teacher_id ? "—" : "Non assigné",
        slot.class_room_id ? "—" : "Non assigné",
      ];

      const rowY = yStart;

      rowData.forEach((cell, i) => {
        const x = 50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0);
        doc.rect(50, rowY, columnWidths[i], 20).fillAndStroke();
        doc.text(cell, 55 + (i * 0), rowY + 3, { width: columnWidths[i] - 10 });
      });

      yStart = rowY + 20;
    });

    doc.end();
  });
}