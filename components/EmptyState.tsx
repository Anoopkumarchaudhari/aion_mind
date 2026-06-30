"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { cardItemVariants, pageShellVariants } from "@/lib/motion";

type EmptyStateProps = {
  controls: ReactNode;
  accountName?: string;
  onPromptSelect?: (prompt: string) => void;
};

export function EmptyState({ controls, accountName }: EmptyStateProps) {
  const [greeting, setGreeting] = useState("Welcome back");
  const firstName = getFirstName(accountName);

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return (
    <motion.section
      className="hero-empty"
      aria-label="Start a chat"
      variants={pageShellVariants}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <div className="hero-content">
        <button className="hero-more-button" type="button" aria-label="More dashboard actions" title="More">
          <MoreHorizontal size={18} />
        </button>

        <motion.header className="dashboard-hero-heading" variants={cardItemVariants}>
          <h1>
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p>What would you like to explore today?</p>
        </motion.header>

        <motion.div className="dashboard-hero-logo" variants={cardItemVariants}>
          <img src="/Aria%20logo/logo.jpeg" alt="Aria" />
        </motion.div>

        <motion.div className="hero-controls" variants={cardItemVariants}>
          {controls}
        </motion.div>
      </div>
    </motion.section>
  );
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

function getFirstName(name?: string) {
  return name?.trim().split(/\s+/)[0] ?? "";
}
