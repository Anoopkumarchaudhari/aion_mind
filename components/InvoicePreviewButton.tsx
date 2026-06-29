"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Download, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { downloadInvoice, getInvoiceBlobUrl } from "@/lib/invoice";
import type { BillingPayment } from "@/store/useBillingStore";

type Account = { name: string; email: string };

/** Eye-icon button that previews the invoice PDF in an in-page popup. */
export function InvoicePreviewButton({ payment, account }: { payment: BillingPayment; account: Account }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const openPreview = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const blobUrl = await getInvoiceBlobUrl(payment, account);
      setUrl(blobUrl);
      setOpen(true);
    } catch {
      toast.error("Could not generate the invoice preview.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && url) {
      URL.revokeObjectURL(url);
      setUrl(null);
    }
  };

  return (
    <>
      <button
        className="invoice-eye-button"
        type="button"
        onClick={openPreview}
        disabled={loading}
        title="View invoice"
        aria-label="View invoice"
      >
        <Eye size={15} />
      </button>

      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-card invoice-preview-card">
            <div className="dialog-heading">
              <div>
                <Dialog.Title className="dialog-title">Invoice preview</Dialog.Title>
                <Dialog.Description className="dialog-description">{payment.label}</Dialog.Description>
              </div>
              <Dialog.Close className="dialog-close" aria-label="Close">
                <X size={16} />
              </Dialog.Close>
            </div>

            {url ? <iframe className="invoice-preview-frame" src={url} title="Invoice preview" /> : null}

            <div className="dialog-actions">
              <Dialog.Close className="ghost-button" type="button">
                Close
              </Dialog.Close>
              <button className="primary-button" type="button" onClick={() => void downloadInvoice(payment, account)}>
                <Download size={14} />
                Download PDF
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
