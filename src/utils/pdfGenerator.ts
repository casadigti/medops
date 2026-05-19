import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDisplayDate } from './dateUtils';
import type { Surgery, SurgeryConsumption } from '../types/domain';

export const generateActaQuirurgica = (surgery: Surgery, consumptions: SurgeryConsumption[] = []): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MEDOPS', 15, 20);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('ACTA DE CONSUMO QUIRÚRGICO', 15, 30);

  doc.setFontSize(10);
  doc.text(`Emisión: ${formatDisplayDate(new Date())}`, pageWidth - 15, 25, { align: 'right' });

  doc.setTextColor(30, 41, 59);
  let y = 55;

  const drawInfo = (label: string, value: string | undefined | null, x: number, yPos: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label.toUpperCase(), x, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(value || 'N/A', x, yPos + 6);
  };

  drawInfo('Paciente', surgery.patient_name, 15, y);
  drawInfo('Fecha Cirugía', formatDisplayDate(surgery.surgery_date), 110, y);

  y += 20;
  drawInfo('Cirujano', (surgery.surgeon as { full_name?: string } | undefined)?.full_name, 15, y);
  drawInfo('Centro Médico', (surgery.hospital as { name?: string } | undefined)?.name, 110, y);

  y += 20;
  drawInfo('Procedimiento', surgery.procedure_type, 15, y);
  drawInfo('Aseguradora', (surgery.ars as { name?: string } | undefined)?.name || 'Privado', 110, y);

  y += 20;
  if (surgery.operating_room) {
    drawInfo('Quirófano', surgery.operating_room, 15, y);
  }

  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('DETALLE DE MATERIALES E IMPLANTES', 15, y);

  const tableData = consumptions.map((c, index) => [
    index + 1,
    (c.implant_lots as { implants?: { name?: string } } | undefined)?.implants?.name || 'N/A',
    (c.implant_lots as { implants?: { sku?: string } } | undefined)?.implants?.sku || 'N/A',
    (c.implant_lots as { lot_number?: string } | undefined)?.lot_number || 'N/A',
    c.auth_number || '—',
    c.quantity_used,
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
      5: { halign: 'center', fontStyle: 'bold' },
    },
  });

  let finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  if (surgery.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('OBSERVACIONES:', 15, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitNotes = doc.splitTextToSize(surgery.notes, pageWidth - 30);
    doc.text(splitNotes, 15, finalY + 6);
    finalY += splitNotes.length * 6 + 10;
  }

  if (finalY > 230) {
    doc.addPage();
    finalY = 30;
  } else {
    finalY = 250;
  }

  const sigWidth = 60;
  doc.setDrawColor(200, 200, 200);

  doc.line(15, finalY, 15 + sigWidth, finalY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGADO POR', 15, finalY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(surgery.delivery_responsible || 'Técnico MedOps', 15, finalY + 10);

  doc.line(pageWidth - 15 - sigWidth, finalY, pageWidth - 15, finalY);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBIDO (CENTRO/CIRUJANO)', pageWidth - 15, finalY + 5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text('Firma y Sello', pageWidth - 15, finalY + 10, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Documento generado automáticamente por MedOps - Gestión Médica Inteligente', pageWidth / 2, 285, { align: 'center' });

  doc.save(`Acta_Quirurgica_${surgery.patient_name.replace(/\s+/g, '_')}_${formatDisplayDate(new Date()).replace(/\//g, '-')}.pdf`);
};
