import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Surgery } from '../types/domain';

interface DateRange {
  start: string;
  end: string;
}

interface ReplenishmentItem {
  name: string;
  sku: string;
  category: string;
  current_stock: number;
  total_used: number;
  unit_cost: number;
}

export const printService = {
  generateDeliverySheet(surgery: Surgery): void {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MedOps', margin, 25);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('GESTIÓN LOGÍSTICA MÉDICA', margin, 32);

    doc.setFontSize(14);
    doc.text('HOJA DE ENTREGA', pageWidth - margin, 26, { align: 'right' });
    doc.setFontSize(9);
    doc.text(`ID: ${surgery.id.slice(0, 8).toUpperCase()}`, pageWidth - margin, 32, { align: 'right' });

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE LA CIRUGÍA', margin, 55);
    doc.line(margin, 57, pageWidth - margin, 57);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const infoY = 65;
    const col2 = pageWidth / 2;

    doc.text('Paciente:', margin, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(surgery.patient_name || 'N/A', margin + 25, infoY);

    doc.setFont('helvetica', 'normal');
    doc.text('Hospital:', margin, infoY + 8);
    doc.text((surgery.hospital as { name?: string } | undefined)?.name || 'N/A', margin + 25, infoY + 8);

    doc.text('Fecha:', col2, infoY);
    doc.text(new Date(surgery.surgery_date).toLocaleString('es-ES'), col2 + 25, infoY);

    doc.text('Cirujano:', col2, infoY + 8);
    doc.text((surgery.surgeon as { full_name?: string } | undefined)?.full_name || 'N/A', col2 + 25, infoY + 8);

    doc.text('Procedimiento:', margin, infoY + 16);
    doc.text(surgery.procedure_type || 'N/A', margin + 25, infoY + 16);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('BANDEJAS Y EQUIPOS ENTREGADOS', margin, infoY + 35);

    const trayRows = ((surgery.surgery_trays || []) as Array<{ tray?: { code?: string; name?: string; procedure_type?: string; is_support_tray?: boolean } }>).map(st => [
      st.tray?.code || '-',
      st.tray?.name || 'Set no especificado',
      st.tray?.procedure_type || '-',
      st.tray?.is_support_tray ? 'APOYO – A DEVOLVER' : 'OK',
    ]);

    autoTable(doc, {
      startY: infoY + 38,
      head: [['Código', 'Descripción del Set', 'Especialidad', 'Estado / Tipo']],
      body: trayRows.length ? trayRows : [['-', 'No hay bandejas asignadas', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = trayRows[data.row.index]?.[3];
          if (val === 'APOYO – A DEVOLVER') {
            (data.cell.styles as unknown as Record<string, unknown>).textColor = [180, 83, 9];
            (data.cell.styles as unknown as Record<string, unknown>).fontStyle = 'bold';
          }
        }
      },
      margin: { left: margin, right: margin },
    });

    const finalY = (doc as jsPDF & { lastAutoTable: { finalY?: number } }).lastAutoTable.finalY || infoY + 60;

    if (surgery.notes) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Notas / Observaciones:', margin, finalY + 15);
      doc.setFont('helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(surgery.notes, pageWidth - margin * 2);
      doc.text(splitNotes, margin, finalY + 22);
    }

    const sigY = 250;
    doc.line(margin, sigY, margin + 60, sigY);
    doc.text('Entregado por (Técnico)', margin + 30, sigY + 5, { align: 'center' });
    doc.text(surgery.delivery_responsible || '_________________', margin + 30, sigY + 12, { align: 'center' });

    doc.line(pageWidth - margin - 60, sigY, pageWidth - margin, sigY);
    doc.text('Recibido por (Hospital)', pageWidth - margin - 30, sigY + 5, { align: 'center' });
    doc.text('Firma y Sello', pageWidth - margin - 30, sigY + 12, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Este documento es una constancia de entrega de equipos médicos propiedad de MedOps.',
      pageWidth / 2, 285, { align: 'center' }
    );

    doc.save(`Hoja_Entrega_${surgery.patient_name.replace(/\s+/g, '_')}.pdf`);
  },

  generateReplenishmentReport(data: unknown, dateRange: DateRange, summary: Record<string, ReplenishmentItem>): void {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('MedOps - Reporte de Reposición', margin, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periodo: ${dateRange.start} al ${dateRange.end}`, margin, 28);

    const daysInRange = Math.max(
      1,
      Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / 86400000)
    );

    const rows = Object.values(summary).map(item => {
      const dailyConsumption = item.total_used / daysInRange;
      const daysLeft = dailyConsumption > 0 ? Math.floor(item.current_stock / dailyConsumption) : null;
      return [
        item.name,
        item.sku,
        item.category,
        item.current_stock,
        item.total_used,
        daysLeft === null ? '∞' : `${daysLeft} días`,
        `RD$ ${(item.total_used * item.unit_cost).toLocaleString()}`,
      ];
    });

    autoTable(doc, {
      startY: 45,
      head: [['Producto', 'SKU', 'Categoría', 'Stock', 'Uso', 'Días Stock', 'Subtotal']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
        6: { halign: 'right' },
      },
    });

    const finalY = (doc as jsPDF & { lastAutoTable: { finalY?: number } }).lastAutoTable.finalY || 50;
    const totalCost = Object.values(summary).reduce((acc, curr) => acc + curr.total_used * curr.unit_cost, 0);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(
      `COSTO TOTAL DE REPOSICIÓN ESTIMADO: RD$ ${totalCost.toLocaleString()}`,
      pageWidth - margin, finalY + 15, { align: 'right' }
    );

    doc.save(`Reporte_Reposicion_${dateRange.start}_${dateRange.end}.pdf`);
  },
};
