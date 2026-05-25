"use client";

import { Toast } from "@/components/Toast";
import type { ChatToast } from "@/store/useChatStore";

type ShareLinkToastProps = {
  toast: ChatToast | null;
  onUndoDelete: () => void;
  onClose: () => void;
};

export function ShareLinkToast({ toast, onUndoDelete, onClose }: ShareLinkToastProps) {
  return (
    <Toast
      toast={toast}
      onAction={toast?.action === "undo-delete" ? onUndoDelete : undefined}
      onClose={onClose}
    />
  );
}
