"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const PROMPTS = [
  "What should we build?",
  "Ask anything. Get the best answer.",
  "One question, multiple minds.",
  "What's on your mind?"
];

export function RotatingHero() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % PROMPTS.length);
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <h1 className="hero-title">
      <AnimatePresence mode="wait">
        <motion.span
          key={PROMPTS[index]}
          initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
          transition={{ duration: 0.34, ease: "easeOut" }}
        >
          {PROMPTS[index]}
        </motion.span>
      </AnimatePresence>
    </h1>
  );
}
