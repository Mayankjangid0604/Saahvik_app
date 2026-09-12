import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface ReceiptPayment {
  id: string;
  amountPaisa: bigint;
  method: string;
  paidOn: Date;
  createdAt: Date;
}

export interface ReceiptResident {
  fullName: string;
  phone?: string | null;
  email?: string | null;
}

export interface ReceiptOrg {
  name: string;
}

@Injectable()
export class ReceiptService {
  /**
   * Format paisa (BigInt) to ₹XX,XXX.XX display string.
   * All arithmetic uses BigInt; no float conversion for money math.
   */
  formatPaisa(paisa: bigint): string {
    const isNegative = paisa < 0n;
    const absPaisa = isNegative ? -paisa : paisa;
    const rupees = absPaisa / 100n;
    const remainder = absPaisa % 100n;
    const decimalPart = remainder.toString().padStart(2, '0');

    // Format rupees with Indian comma grouping: last 3 digits, then groups of 2
    const rupeeStr = rupees.toString();
    let formatted: string;
    if (rupeeStr.length <= 3) {
      formatted = rupeeStr;
    } else {
      const lastThree = rupeeStr.slice(-3);
      const remaining = rupeeStr.slice(0, -3);
      const groups: string[] = [];
      let i = remaining.length;
      while (i > 0) {
        const start = Math.max(0, i - 2);
        groups.unshift(remaining.slice(start, i));
        i = start;
      }
      formatted = groups.join(',') + ',' + lastThree;
    }

    const sign = isNegative ? '-' : '';
    return `${sign}₹${formatted}.${decimalPart}`;
  }

  /**
   * Generate a PDF receipt buffer for a payment.
   */
  async generateReceipt(
    payment: ReceiptPayment,
    resident: ReceiptResident,
    org: ReceiptOrg,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(org.name, { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fontSize(14)
        .font('Helvetica')
        .text('Payment Receipt', { align: 'center' });
      doc.moveDown(1);

      // Divider
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#333333')
        .stroke();
      doc.moveDown(1);

      // Receipt details
      const receiptNumber = payment.id.slice(0, 8).toUpperCase();
      const paidOnDate = payment.paidOn instanceof Date
        ? payment.paidOn.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : String(payment.paidOn);

      const methodLabels: Record<string, string> = {
        cash: 'Cash',
        upi: 'UPI',
        bank_transfer: 'Bank Transfer',
        razorpay: 'Razorpay (Online)',
      };

      doc.fontSize(11).font('Helvetica');

      const labelX = 50;
      const valueX = 200;

      const addRow = (label: string, value: string) => {
        doc.font('Helvetica-Bold').text(label, labelX, doc.y, { continued: false });
        doc.font('Helvetica').text(value, valueX, doc.y - doc.currentLineHeight());
        doc.moveDown(0.6);
      };

      addRow('Receipt No:', receiptNumber);
      addRow('Date:', paidOnDate);
      addRow('Resident:', resident.fullName);
      if (resident.phone) {
        addRow('Phone:', resident.phone);
      }
      addRow('Amount:', this.formatPaisa(payment.amountPaisa));
      addRow('Payment Method:', methodLabels[payment.method] || payment.method);

      doc.moveDown(1);

      // Divider
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#333333')
        .stroke();
      doc.moveDown(1);

      // Footer
      doc
        .fontSize(9)
        .fillColor('#666666')
        .text('This is a computer-generated receipt and does not require a signature.', {
          align: 'center',
        });
      doc.moveDown(0.3);
      doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, {
        align: 'center',
      });

      doc.end();
    });
  }
}
