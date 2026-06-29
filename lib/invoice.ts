import { jsPDF } from "jspdf";
import { BUSINESS_INFO } from "@/lib/businessInfo";
import type { BillingPayment } from "@/store/useBillingStore";

function formatDate(value: number) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

// Helvetica (jsPDF's built-in font) has no glyph for the ₹ symbol, so amounts
// are written as "Rs." in the PDF to stay readable.
function money(amount: number) {
  return `Rs. ${amount.toLocaleString("en-IN")}`;
}

const LOGO_SRC = encodeURI("/Aria logo/aria-icon.png");

/** Load a public image into a PNG data URL (client-side only). */
async function loadImage(src: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    return null;
  }
}

/** Fill a rectangle with a smooth left→right gradient (jsPDF has no native gradient). */
function fillGradient(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  from: [number, number, number],
  to: [number, number, number]
) {
  const steps = 64;
  const sliceW = w / steps;
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(from[0] + (to[0] - from[0]) * t),
      Math.round(from[1] + (to[1] - from[1]) * t),
      Math.round(from[2] + (to[2] - from[2]) * t)
    );
    // +1 overlap so no hairline seams appear between slices
    doc.rect(x + sliceW * i, y, sliceW + 1, h, "F");
  }
}

/** Faint, diagonally tiled "AriaMindX" watermark across the whole page. */
function drawWatermark(doc: jsPDF) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(232, 236, 248);
  const stepX = 200;
  const stepY = 130;
  let row = 0;
  for (let y = 60; y < pageH + stepY; y += stepY) {
    const offset = (row % 2) * (stepX / 2);
    for (let x = -40 + offset; x < pageW + stepX; x += stepX) {
      doc.text("AriaMindX", x, y, { angle: 28 });
    }
    row += 1;
  }
}

/** Build the styled invoice PDF (shared by download + preview). */
async function buildInvoiceDoc(
  payment: BillingPayment,
  account: { name: string; email: string }
): Promise<{ doc: jsPDF; invoiceNo: string }> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 56;
  const right = pageW - 56;
  const cobalt: [number, number, number] = [59, 109, 245];

  const invoiceNo = (payment.paymentId ?? payment.id).slice(-12).toUpperCase();
  const logo = await loadImage(LOGO_SRC);

  // 1) Watermark first so all content sits on top of it.
  drawWatermark(doc);

  // 2) Highlighted header band — charcoal → slate gray gradient --------------
  const bandH = 128;
  fillGradient(doc, 0, 0, pageW, bandH, [43, 47, 54], [88, 96, 109]);
  // subtle light accent base line for a crisp edge
  doc.setFillColor(148, 155, 165);
  doc.rect(0, bandH, pageW, 3, "F");

  // logo (white rounded tile behind it for contrast)
  if (logo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(left - 4, 36, 56, 56, 12, 12, "F");
    doc.addImage(logo.dataUrl, "PNG", left, 40, 48, 48);
  }

  const nameX = logo ? left + 64 : left;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(BUSINESS_INFO.brandName, nameX, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(208, 211, 217);
  doc.text(BUSINESS_INFO.legalName, nameX, 76);

  // company contact block — right aligned, light gray
  doc.setFontSize(8.6);
  doc.setTextColor(220, 223, 228);
  doc.text(BUSINESS_INFO.email, right, 44, { align: "right" });
  doc.text(BUSINESS_INFO.phone, right, 58, { align: "right" });
  doc.text(BUSINESS_INFO.address, right, 72, { align: "right" });
  doc.text(BUSINESS_INFO.website.replace(/^https?:\/\//, ""), right, 86, { align: "right" });

  // 3) Invoice title + PAID badge --------------------------------------------
  let y = bandH + 52;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(24, 24, 27);
  doc.text("Invoice", left, y);

  // PAID pill (top-right of the title row)
  const pillW = 66;
  const pillH = 24;
  const pillX = right - pillW;
  const pillY = y - 17;
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(pillX, pillY, pillW, pillH, 12, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(4, 120, 87);
  doc.text("PAID", pillX + pillW / 2, pillY + 16, { align: "center" });

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Invoice #${invoiceNo}    .    ${formatDate(payment.createdAt)}`, left, y);

  // 4) Billed to / Payment ID -------------------------------------------------
  y += 40;
  doc.setFontSize(8.6);
  doc.setTextColor(140, 140, 140);
  doc.text("BILLED TO", left, y);
  doc.text("PAYMENT ID", 330, y);

  y += 17;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(28, 28, 31);
  doc.text(account.name || "Customer", left, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70, 70, 74);
  doc.text(payment.paymentId ?? payment.id, 330, y);

  y += 14;
  doc.setTextColor(120, 120, 120);
  doc.text(account.email || "", left, y);

  // 5) Line items -------------------------------------------------------------
  y += 36;
  doc.setDrawColor(224, 226, 232);
  doc.setLineWidth(1);
  doc.line(left, y, right, y);

  y += 18;
  doc.setFontSize(8.6);
  doc.setTextColor(140, 140, 140);
  doc.text("DESCRIPTION", left, y);
  doc.text("CREDITS", 360, y);
  doc.text("AMOUNT", right, y, { align: "right" });
  y += 10;
  doc.line(left, y, right, y);

  y += 26;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 34);
  doc.text(payment.label, left, y);
  doc.text(`+${payment.credits.toLocaleString("en-IN")}`, 360, y);
  doc.text(money(payment.amountInr), right, y, { align: "right" });

  y += 18;
  doc.line(left, y, right, y);

  // 6) Total ------------------------------------------------------------------
  y += 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(24, 24, 27);
  doc.text("Total", 430, y);
  doc.setTextColor(...cobalt);
  doc.text(money(payment.amountInr), right, y, { align: "right" });

  // 7) Thank-you block --------------------------------------------------------
  y += 44;
  const boxH = 70;
  doc.setFillColor(237, 242, 255);
  doc.roundedRect(left, y, right - left, boxH, 12, 12, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...cobalt);
  doc.text("Thank you for your business!", left + 18, y + 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 92, 110);
  doc.text(
    `This is a system-generated invoice from ${BUSINESS_INFO.brandName} — a product of ${BUSINESS_INFO.legalName}.`,
    left + 18,
    y + 44
  );
  doc.text(
    `${BUSINESS_INFO.email}   .   ${BUSINESS_INFO.phone}   .   ${BUSINESS_INFO.website.replace(/^https?:\/\//, "")}`,
    left + 18,
    y + 58
  );

  // 8) Bottom legal line ------------------------------------------------------
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 165);
  doc.text(`${BUSINESS_INFO.legalName}  .  ${BUSINESS_INFO.address}`, pageW / 2, pageH - 44, { align: "center" });

  return { doc, invoiceNo };
}

/** Generate and download a styled PDF invoice for a paid payment. */
export async function downloadInvoice(payment: BillingPayment, account: { name: string; email: string }) {
  const { doc, invoiceNo } = await buildInvoiceDoc(payment, account);
  doc.save(`AriaMindX-invoice-${invoiceNo}.pdf`);
}

/** Build the invoice and return an object URL for in-page preview (revoke when done). */
export async function getInvoiceBlobUrl(
  payment: BillingPayment,
  account: { name: string; email: string }
): Promise<string> {
  const { doc } = await buildInvoiceDoc(payment, account);
  return URL.createObjectURL(doc.output("blob"));
}
