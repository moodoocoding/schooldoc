"""Generate a fictional one-page consent notice for the workflow review."""

from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


output = Path(__file__).with_name('synthetic-consent-review.pdf')
page_width, page_height = A4
pdf = canvas.Canvas(str(output), pagesize=A4)
pdf.setTitle('Synthetic Field Trip Consent Review')
pdf.setFont('Helvetica-Bold', 17)
pdf.drawString(48, page_height - 62, 'FIELD TRIP CONSENT - TEST DATA ONLY')
pdf.setFont('Helvetica', 11)
pdf.drawString(48, page_height - 94, 'Please review the trip information before selecting an answer.')
pdf.drawString(48, page_height - 128, 'Student name:')
pdf.line(136, page_height - 131, 370, page_height - 131)
pdf.drawString(48, page_height - 168, 'Do you agree to the field trip?')
pdf.rect(52, page_height - 193, 14, 14)
pdf.drawString(75, page_height - 190, 'Yes')
pdf.rect(185, page_height - 193, 14, 14)
pdf.drawString(208, page_height - 190, 'No')
pdf.drawString(48, page_height - 236, 'Guardian name:')
pdf.line(150, page_height - 239, 370, page_height - 239)
pdf.drawString(48, page_height - 282, 'Signature:')
pdf.line(128, page_height - 285, 370, page_height - 285)
pdf.setStrokeColorRGB(0.7, 0.7, 0.7)
pdf.line(48, page_height - 320, page_width - 48, page_height - 320)
pdf.setFillColorRGB(0.35, 0.35, 0.35)
pdf.setFont('Helvetica', 9)
pdf.drawString(48, 55, 'All names, answers, and links used in this review are fictional.')
pdf.save()
print(output)
