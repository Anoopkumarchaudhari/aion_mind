"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ChatToast } from "@/store/useChatStore";

type ToastProps = {
  toast: ChatToast | null;
  onAction?: () => void;
  onClose: () => void;
};

export function Toast({ toast, onAction, onClose }: ToastProps) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          className="toast"
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          role="status"
        >
          <span>{toast.message}</span>
          {toast.actionLabel ? (
            <button className="toast-action" type="button" onClick={onAction}>
              {toast.actionLabel}
            </button>
          ) : null}
          <button className="toast-close" type="button" onClick={onClose} aria-label="Dismiss">
            ×
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
