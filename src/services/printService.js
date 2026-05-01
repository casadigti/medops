import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const printService = {
  generateDeliverySheet: (surgery) => {
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;

    // --- Header ---
    doc.setFillColor(30, 64, 175); // Primary blue
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
    doc.text(`ID: ${surgery.id.slice(0,8).toUpperCase()}`, pageWidth - margin, 32, { align: 'right' });

    // --- Patient & Info Block ---
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMACIÓN DE LA CIRUGÍA', margin, 55);
    doc.line(margin, 57, pageWidth - margin, 57);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const infoY = 65;
    const col2 = pageWidth / 2;

    doc.text(`Paciente:`, margin, infoY);
    doc.setFont('helvetica', 'bold');
    doc.text(surgery.patient_name || 'N/A', margin + 25, infoY);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Hospital:`, margin, infoY + 8);
    doc.text(surgery.hospital?.name || 'N/A', margin + 25, infoY + 8);

    doc.text(`Fecha:`, col2, infoY);
    doc.text(new Date(surgery.surgery_date).toLocaleString('es-ES'), col2 + 25, infoY);
    
    doc.text(`Cirujano:`, col2, infoY + 8);
    doc.text(surgery.surgeon?.full_name || 'N/A', col2 + 25, infoY + 8);

    doc.text(`Procedimiento:`, margin, infoY + 16);
    doc.text(surgery.procedure_type || 'N/A', margin + 25, infoY + 16);

    // --- Trays Table ---
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('BANDEJAS Y EQUIPOS ENTREGADOS', margin, infoY + 35);
    
    const trays = (surgery.surgery_trays || []).map(st => [
      st.tray?.code || '-',
      st.tray?.name || 'Set no especificado',
      st.tray?.procedure_type || '-',
      'OK'
    ]);

    doc.autoTable({
      startY: infoY + 38,
      head: [['Código', 'Descripción del Set', 'Especialidad', 'Estado']],
      body: trays.length ? trays : [['-', 'No hay bandejas asignadas', '-', '-']],
      theme: 'striped',
      headStyles: { fillColor: [30, 64, 175], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: margin, right: margin }
    });

    const finalY = doc.lastAutoTable.finalY || infoY + 60;

    // --- Notes ---
    if (surgery.notes) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Notas / Observaciones:', margin, finalY + 15);
      doc.setFont('helvetica', 'normal');
      const splitNotes = doc.splitTextToSize(surgery.notes, pageWidth - (margin * 2));
      doc.text(splitNotes, margin, finalY + 22);
    }

    // --- Signatures ---
    const sigY = 250;
    doc.line(margin, sigY, margin + 60, sigY);
    doc.text('Entregado por (Técnico)', margin + 30, sigY + 5, { align: 'center' });
    doc.text(surgery.delivery_responsible || '_________________', margin + 30, sigY + 12, { align: 'center' });

    doc.line(pageWidth - margin - 60, sigY, pageWidth - margin, sigY);
    doc.text('Recibido por (Hospital)', pageWidth - margin - 30, sigY + 5, { align: 'center' });
    doc.text('Firma y Sello', pageWidth - margin - 30, sigY + 12, { align: 'center' });

    // --- Footer ---
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const footerText = 'Este documento es una constancia de entrega de equipos médicos propiedad de MedOps.';
    doc.text(footerText, pageWidth / 2, 285, { align: 'center' });

    doc.save(`Hoja_Entrega_${surgery.patient_name.replace(/\s+/g, '_')}.pdf`);
  }
};
