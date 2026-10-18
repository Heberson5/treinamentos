import jsPDF from 'jspdf';

// Tipos de dados para exportação
interface ExportColumn {
  header: string;
  key: string;
  width?: number;
}

interface ExportOptions {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: Record<string, any>[];
  format: 'excel' | 'pdf';
}

// Exportar para Excel (CSV com BOM para suporte a UTF-8)
export function exportToExcel(options: ExportOptions): void {
  const { filename, title, columns, data } = options;
  
  // Criar cabeçalho
  const headers = columns.map(col => col.header);
  
  // Criar linhas de dados
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      // Escapar vírgulas e aspas
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    })
  );
  
  // Montar CSV com BOM para suporte a UTF-8
  const BOM = '\uFEFF';
  const csvContent = [
    [title],
    [],
    headers,
    ...rows
  ].map(row => row.join(';')).join('\n');
  
  // Criar blob e download
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

// Exportar para PDF
export function exportToPDF(options: ExportOptions): void {
  const { filename, title, subtitle, columns, data } = options;
  
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;
  
  // Título
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  
  // Subtítulo
  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  }
  
  // Data de geração
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;
  
  // Calcular larguras das colunas
  const availableWidth = pageWidth - (margin * 2);
  const colWidth = availableWidth / columns.length;
  
  // Cabeçalho da tabela
  doc.setFillColor(147, 51, 234); // Roxo
  doc.rect(margin, yPosition, availableWidth, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255);
  
  columns.forEach((col, index) => {
    const x = margin + (index * colWidth) + (colWidth / 2);
    doc.text(col.header, x, yPosition + 5.5, { align: 'center' });
  });
  
  yPosition += 8;
  
  // Dados da tabela
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  data.forEach((row, rowIndex) => {
    // Verificar se precisa de nova página
    if (yPosition > pageHeight - margin - 10) {
      doc.addPage();
      yPosition = margin;
      
      // Repetir cabeçalho na nova página
      doc.setFillColor(147, 51, 234);
      doc.rect(margin, yPosition, availableWidth, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255);
      
      columns.forEach((col, index) => {
        const x = margin + (index * colWidth) + (colWidth / 2);
        doc.text(col.header, x, yPosition + 5.5, { align: 'center' });
      });
      
      yPosition += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }
    
    // Alternar cores das linhas
    if (rowIndex % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, yPosition, availableWidth, 7, 'F');
    }
    
    doc.setTextColor(50);
    columns.forEach((col, index) => {
      const x = margin + (index * colWidth) + (colWidth / 2);
      const value = String(row[col.key] ?? '');
      // Truncar texto longo
      const maxChars = Math.floor(colWidth / 2);
      const displayValue = value.length > maxChars ? value.substring(0, maxChars - 2) + '..' : value;
      doc.text(displayValue, x, yPosition + 5, { align: 'center' });
    });
    
    yPosition += 7;
  });
  
  // Rodapé
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }
  
  // Download
  doc.save(`${filename}.pdf`);
}

// Função auxiliar para download
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Função helper para exportar dados genéricos
export function exportData(
  format: 'excel' | 'pdf',
  options: Omit<ExportOptions, 'format'>
): void {
  if (format === 'excel') {
    exportToExcel({ ...options, format });
  } else {
    exportToPDF({ ...options, format });
  }
}
