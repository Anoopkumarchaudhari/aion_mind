"use client";

import { motion } from "framer-motion";
import { AionLogo } from "@/components/AionLogo";
import { messageRowVariants } from "@/lib/motion";
import type { AionModelId } from "@/types/aion";

const LABELS: Record<AionModelId, string> = {
  "aria-instant": "Preparing your answer",
  "aria-diverse": "Asking your chosen model",
  "aion-mind": "Combining every model",
  "aion-mind-pro": "Gathering every model's answer",
  "aion-mind-analyzer": "Routing to the best model"
};

export function ThinkingIndicator({ model }: { model: AionModelId }) {
  return (
    <motion.div
      className="thinking-indicator"
      custom="assistant"
      variants={messageRowVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      layout="position"
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
