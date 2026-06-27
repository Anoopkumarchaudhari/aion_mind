import { jsPDF } from "jspdf";
import type { BillingPayment } from "@/store/useBillingStore";

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

// Helvetica (jsPDF's built-in font) has no glyph for the ₹ symbol, so amounts
// are written as "Rs." in the PDF to stay readable.
function money(amount: number) {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

/** Generate and download a real PDF invoice for a paid payment. */
export function downloadInvoice(payment: BillingPayment, account: { name: string; email: string }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const left = 56;
  const right = 540;
  let y = 70;

  const invoiceNo = (payment.paymentId ?? payment.id).slice(-12).toUpperCase();

  // Brand
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(99, 102, 241);
  doc.text("AriaMindX", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("By JB Crownstone", left, y + 15);

  // Paid badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(4, 120, 87);
  doc.text("PAID", right, y, { align: "right" });

  y += 58;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(17);
  doc.text("Invoice", left, y);

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Invoice #${invoiceNo}   .   ${formatDate(payment.createdAt)}`, left, y);

  // Billed to / payment id
  y += 38;
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text("BILLED TO", left, y);
  doc.text("PAYMENT ID", 330, y);

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(25, 25, 25);
  doc.text(account.name || "Customer", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(payment.paymentId ?? payment.id, 330, y);

  y += 14;
  doc.setTextColor(120, 120, 120);
  doc.text(account.email || "", left, y);

  // Line items
  y += 34;
  doc.setDrawColor(225, 225, 225);
  doc.line(left, y, right, y);
  y += 18;
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  doc.text("DESCRIPTION", left, y);
  doc.text("CREDITS", 360, y);
  doc.text("AMOUNT", right, y, { align: "right" });
  y += 10;
  doc.line(left, y, right, y);

  y += 24;
  doc.setFontSize(11);
  doc.setTextColor(25, 25, 25);
  doc.text(payment.label, left, y);
  doc.text(`+${payment.credits.toLocaleString("en-IN")}`, 360, y);
  doc.text(money(payment.amountInr), right, y, { align: "right" });

  y += 16;
  doc.line(left, y, right, y);

  // Total
  y += 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total", 430, y);
  doc.text(money(payment.amountInr), right, y, { align: "right" });

  // Footer
  y += 54;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text("Thank you for using AriaMindX. This is a system-generated invoice.", left, y);

  doc.save(`AriaMindX-invoice-${invoiceNo}.pdf`);
}
