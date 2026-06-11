"use client";

import { motion } from "framer-motion";
import { AionLogo } from "@/components/AionLogo";
import type { AionModelId } from "@/types/aion";

const LABELS: Record<AionModelId, string> = {
  "aion-mind": "Preparing your answer",
  "aion-mind-pro": "Starting research pass",
  "aion-mind-analyzer": "Starting analysis pass"
};

export function ThinkingIndicator({ model }: { model: AionModelId }) {
  return (
    <motion.div
      className="thinking-indicator"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <span className="thinking-logo" aria-hidden="true">
        <AionLogo size={24} decorative />
      </span>
      <span>{LABELS[model]}</span>
      <span className="typing-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="streaming-caret" aria-hidden="true" />
    </motion.div>
  );
}
