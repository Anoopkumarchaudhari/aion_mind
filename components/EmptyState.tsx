"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { BarChart3, Code2, FileText, MoreHorizontal, Search } from "lucide-react";

type EmptyStateProps = {
  controls: ReactNode;
  accountName?: string;
  onPromptSelect?: (prompt: string) => void;
};

const DASHBOARD_ACTIONS = [
  {
    title: "Summarize a document",
    description: "Paste or upload a file",
    prompt: "Summarize this document and highlight the key takeaways.",
    icon: FileText,
    tone: "blue"
  },
  {
    title: "Analyze data",
    description: "Find trends & insights",
    prompt: "Analyze this data and point out the most important trends, risks, and opportunities.",
    icon: BarChart3,
    tone: "green"
  },
  {
    title: "Research a topic",
    description: "Deep dive with sources",
    prompt: "Research this topic and give me a clear, sourced briefing:",
    icon: Search,
    tone: "amber"
  },
  {
    title: "Write code",
    description: "Build, debug, refactor",
    prompt: "Help me write clean code for this task:",
    icon: Code2,
    tone: "rose"
  }
] as const;

export function EmptyState({ controls, accountName, onPromptSelect }: EmptyStateProps) {
  const [greeting, setGreeting] = useState("Welcome back");
  const firstName = getFirstName(accountName);

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  return (
    <motion.section
      className="hero-empty"
      aria-label="Start a chat"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.34, ease: "easeOut" }}
    >
      <div className="hero-content">
        <button className="hero-more-button" type="button" aria-label="More dashboard actions" title="More">
          <MoreHorizontal size={18} />
        </button>

        <header className="dashboard-hero-heading">
          <h1>
            {greeting}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p>What would you like to explore today?</p>
        </header>

        <div className="dashboard-action-grid" aria-label="Suggested starting points">
          {DASHBOARD_ACTIONS.map((action) => {
            const Icon = action.icon;

            return (
              <button
                className={`dashboard-action-card is-${action.tone}`}
                key={action.title}
                type="button"
                onClick={() => onPromptSelect?.(action.prompt)}
              >
                <Icon size={24} aria-hidden="true" />
                <span className="dashboard-action-title">{action.title}</span>
                <span className="dashboard-action-description">{action.description}</span>
              </button>
            );
          })}
        </div>

        <div className="hero-controls">{controls}</div>
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
