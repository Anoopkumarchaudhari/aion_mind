"use client";

import { AnimatePresence, motion } from "framer-motion";

type TempBannerProps = {
  active: boolean;
};

export function TempBanner({ active }: TempBannerProps) {
  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          className="temp-banner"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          👻 Temporary chat · won't be saved
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
