import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { ReportRow } from '@/types'

export function generatePDF(data: ReportRow[], month: string): void {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(16)
  doc.setTextColor('#ec5b13')
  doc.text('CMR Technical Campus', 105, 20, { align: 'center' })
  doc.setFontSize(12)
  doc.setTextColor('#000000')
  doc.text('CSE (AI & ML) Department -- Faculty Leave Report', 105, 30, { align: 'center' })
  doc.setFontSize(10)
  doc.setTextColor('#666666')
  doc.text(`Report for: ${month}`, 105, 38, { align: 'center' })
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 105, 44, { align: 'center' })

  // Table
  autoTable(doc, {
    startY: 52,
    head: [['Faculty Name', 'Faculty ID', 'Email', 'Leaves Taken', 'Exceeded 1hr Limit']],
    body: data.map((r) => [r.fullName, r.facultyId, r.email, r.leaveCount, r.exceededCount]),
    headStyles: { fillColor: [236, 91, 19], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [255, 248, 245] },
    styles: { fontSize: 9, cellPadding: 4 },
  })

  doc.save(`Leave_Report_${month.replace(' ', '_')}.pdf`)
}
