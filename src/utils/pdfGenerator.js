import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDisplayDate } from './dateUtils';

/**
 * Genera un Acta Quirúrgica profesional en formato PDF.
 * @param {Object} surgery - Datos de la cirugía.
 * @param {Array} consumptions - Lista de materiales consumidos.
 */
export const generateActaQuirurgica = (surgery, consumptions = []) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // ─── CABECERA ──────────────────────────────────────────────────────────────
  // Fondo azul para el encabezado
  doc.setFillColor(30, 64, 175); // Blue-800
  doc.rect(0, 0, pageWidth, 40, 'F');

  // Título
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MEDOPS', 15, 20);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('ACTA DE CONSUMO QUIRÚRGICO', 15, 30);

  // Fecha de emisión (derecha)
  doc.setFontSize(10);
  doc.text(`Emisión: ${formatDisplayDate(new Date())}`, pageWidth - 15, 25, { align: 'right' });

  // ─── INFORMACIÓN DE LA CIRUGÍA ────────────────────────────────────────────
  doc.setTextColor(30, 41, 59); // Slate-800
  let y = 55;

  const drawInfo = (label, value, x, y) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(value || 'N/A', x, y + 6);
  };

  drawInfo('Paciente', surgery.patient_name, 15, y);
  drawInfo('Fecha Cirugía', formatDisplayDate(surgery.surgery_date), 110, y);
  
  y += 20;
  drawInfo('Cirujano', surgery.surgeon?.full_name, 15, y);
  drawInfo('Centro Médico', surgery.hospital?.name, 110, y);
  
  y += 20;
  drawInfo('Procedimiento', surgery.procedure_type, 15, y);
  drawInfo('Aseguradora', surgery.ars?.name || 'Privado', 110, y);

  y += 20;
  if (surgery.operating_room) {
    drawInfo('Quirófano', surgery.operating_room, 15, y);
  }

  // ─── TABLA DE MATERIALES ───────────────────────────────────────────────────
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DETALLE DE MATERIALES E IMPLANTES', 15, y);

  const tableData = consumptions.map((c, index) => [
    index + 1,
    c.implant_lots?.implants?.name || 'N/A',
    c.implant_lots?.implants?.sku || 'N/A',
    c.implant_lots?.lot_number || 'N/A',
    c.auth_number || '—',
    c.quantity_used
  ]);

  autoTable(doc, {
    startY: y + 5,
    head: [['#', 'Producto', 'SKU', 'Lote', 'Autorización', 'Cant.']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto' },
      5: { halign: 'center', fontStyle: 'bold' }
    }
  });

  // ─── TOTALES Y NOTAS ──────────────────────────────────────────────────────
  let finalY = doc.lastAutoTable.finalY + 15;

  if (surgery.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('OBSERVACIONES:', 15, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitNotes = doc.splitTextToSize(surgery.notes, pageWidth - 30);
    doc.text(splitNotes, 15, finalY + 6);
    finalY += (splitNotes.length * 6) + 10;
  }

  // ─── SECCIÓN DE FIRMAS ─────────────────────────────────────────────────────
  if (finalY > 230) {
    doc.addPage();
    finalY = 30;
  } else {
    finalY = 250; // Posición fija al final de la página si hay espacio
  }

  const sigWidth = 60;
  doc.setDrawColor(200, 200, 200);
  
  // Firma Técnico
  doc.line(15, finalY, 15 + sigWidth, finalY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGADO POR', 15, finalY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(surgery.delivery_responsible || 'Técnico MedOps', 15, finalY + 10);

  // Firma Cirujano/Centro
  doc.line(pageWidth - 15 - sigWidth, finalY, pageWidth - 15, finalY);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBIDO (CENTRO/CIRUJANO)', pageWidth - 15, finalY + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text('Firma y Sello', pageWidth - 15, finalY + 10, { align: 'right' });

  // Pie de página
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Documento generado automáticamente por MedOps - Gestión Médica Inteligente', pageWidth / 2, 285, { align: 'center' });

  // Descargar PDF
  doc.save(`Acta_Quirurgica_${surgery.patient_name.replace(/\s+/g, '_')}_${formatDisplayDate(new Date()).replace(/\//g, '-')}.pdf`);
};
