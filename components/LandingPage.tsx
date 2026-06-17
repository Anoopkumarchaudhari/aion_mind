"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Building2,
  CheckCircle2,
  Cpu,
  Database,
  FileText,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Languages,
  Layers3,
  Library,
  Menu,
  MessageSquare,
  Mic2,
  NotebookPen,
  Quote as QuoteIcon,
  Scale,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
  WandSparkles,
  X,
  Zap
} from "lucide-react";
import { AionLogo } from "@/components/AionLogo";
import { type BillingPlanId, type ResolvedBillingCatalog } from "@/services/billingCatalog";

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const modelLogos = [
  { label: "OpenAI", src: "/model logo/openai.webp", color: "#22d3ee", latest: "GPT-5.5", intro: "GPT models for fast, versatile reasoning and writing." },
  { label: "Claude", src: "/model logo/claude-ai.webp", color: "#f59e0b", latest: "Claude Opus 4.8", intro: "Deep reasoning and long-context analysis." },
  { label: "Gemini", src: "/model logo/gemini.jpg", color: "#8b5cf6", latest: "Gemini 3.1 Pro", intro: "Multimodal answers across text and vision." },
  { label: "DeepSeek", src: "/model logo/DeepSeek-Emblem.png", color: "#34d399", latest: "DeepSeek V4 Pro", intro: "Efficient open reasoning and strong coding." },
  { label: "Runware", src: "/model logo/Runware.jpg", color: "#fb7185", latest: "FLUX.1 image engine", intro: "Fast, low-cost AI image generation." },
  { label: "Tavily", src: "/model logo/tavily.png", color: "#60a5fa", latest: "Live Search API", intro: "Live web search behind Aria Research." }
];

const tiers = [
  {
    icon: Zap,
    name: "Aria Instant",
    tagline: "Speed · single fast model",
    copy: "The fast default. One quick model handles everyday chat with instant answers, workspace memory, and live verification that kicks in only when a prompt needs current facts.",
    points: ["One fast model for everyday chat", "Workspace memory from saved chats", "Live search only when facts need it"],
    models: "GPT-5.4 mini",
    color: "#22d3ee",
    diagram: {
      main: [
        { icon: MessageSquare, title: "Prompt", sub: "your question" },
        { icon: Bot, title: "Aria Instant", sub: "fast single model" },
        { icon: Sparkles, title: "Answer", sub: "instant reply" }
      ],
      agentIndex: 1,
      subs: [
        { icon: Cpu, label: "Model", role: "GPT-5.4 mini" },
        { icon: Database, label: "Memory", role: "saved chats" },
        { icon: Globe, label: "Live check", role: "current facts" }
      ]
    }
  },
  {
    icon: Layers3,
    name: "Aria Diverse",
    tagline: "Choice · you pick the provider",
    copy: "You choose the engine. Pick ChatGPT, Claude, DeepSeek, or Gemini and Aria sends your prompt straight to that provider's model for a direct single-provider answer.",
    points: ["Choose ChatGPT, Claude, DeepSeek, or Gemini", "Direct answer from the model you pick", "Switch providers anytime"],
    models: "ChatGPT · Claude · DeepSeek · Gemini",
    color: "#a855f7",
    diagram: {
      main: [
        { icon: MessageSquare, title: "Prompt", sub: "your question" },
        { icon: Bot, title: "Aria Diverse", sub: "your chosen provider" },
        { icon: Sparkles, title: "Answer", sub: "direct reply" }
      ],
      agentIndex: 1,
      subs: [
        { icon: Cpu, label: "ChatGPT", role: "you pick" },
        { icon: Cpu, label: "Claude", role: "you pick" },
        { icon: Cpu, label: "DeepSeek", role: "you pick" },
        { icon: Cpu, label: "Gemini", role: "you pick" }
      ]
    }
  },
  {
    icon: BrainCircuit,
    name: "Aria Mind",
    tagline: "Consensus · all models, one answer",
    copy: "Every model answers, then a judge merges them. Aria asks all four providers in parallel and a GPT-5.5 judge synthesizes the single strongest answer from their combined output.",
    points: ["All 4 providers answer in parallel", "GPT-5.5 judge merges the best parts", "One synthesized final answer"],
    models: "OpenAI · Anthropic · DeepSeek · Gemini → GPT-5.5 judge",
    color: "#34d399",
    diagram: {
      main: [
        { icon: MessageSquare, title: "Prompt", sub: "one question" },
        { icon: Layers3, title: "Fan out", sub: "all 4 models" },
        { icon: Scale, title: "Judge", sub: "merges answers" },
        { icon: CheckCircle2, title: "Final", sub: "one best answer" }
      ],
      agentIndex: 2,
      subs: [
        { icon: Cpu, label: "OpenAI", role: "draft A" },
        { icon: Cpu, label: "Anthropic", role: "draft B" },
        { icon: Cpu, label: "DeepSeek", role: "draft C" },
        { icon: Cpu, label: "Gemini", role: "draft D" }
      ]
    }
  },
  {
    icon: Layers3,
    name: "Aria Research",
    tagline: "Compare · all models side by side",
    copy: "See every model's take at once. Aria sends your prompt to all four providers and shows each answer side by side, color-coded by provider, so you can compare them directly.",
    points: ["All 4 providers answer your prompt", "Every answer shown side by side", "Color-coded by provider"],
    models: "ChatGPT · Claude · DeepSeek · Gemini",
    color: "#60a5fa",
    diagram: {
      main: [
        { icon: MessageSquare, title: "Prompt", sub: "your question" },
        { icon: Layers3, title: "Aria Research", sub: "asks every model" },
        { icon: FileText, title: "Compare", sub: "side by side" }
      ],
      agentIndex: 1,
      subs: [
        { icon: Cpu, label: "ChatGPT", role: "answer 1" },
        { icon: Cpu, label: "Claude", role: "answer 2" },
        { icon: Cpu, label: "DeepSeek", role: "answer 3" },
        { icon: Cpu, label: "Gemini", role: "answer 4" }
      ]
    }
  },
  {
    icon: ScanSearch,
    name: "Aria Analyzer",
    tagline: "Routing · best model per question",
    copy: "Aria reads your question, picks the single best provider and model for it, then answers — no manual choosing. A GPT-5.5 router classifies intent and routes to the strongest fit.",
    points: ["Analyzes your question's intent", "GPT-5.5 router picks the best model", "Answers from the chosen model"],
    models: "Auto · OpenAI · Anthropic · DeepSeek · Gemini",
    color: "#f59e0b",
    diagram: {
      main: [
        { icon: MessageSquare, title: "Prompt", sub: "your question" },
        { icon: ScanSearch, title: "Router", sub: "reads intent" },
        { icon: Bot, title: "Best model", sub: "picked for you" },
        { icon: Sparkles, title: "Answer", sub: "from that model" }
      ],
      agentIndex: 1,
      subs: [
        { icon: Cpu, label: "OpenAI", role: "candidate" },
        { icon: Cpu, label: "Anthropic", role: "candidate" },
        { icon: Cpu, label: "DeepSeek", role: "candidate" },
        { icon: Cpu, label: "Gemini", role: "candidate" }
      ]
    }
  }
];

const capabilities = [
  { icon: MessageSquare, title: "Text", accent: "#22d3ee", copy: "Chat, write, brainstorm, and reason with the right model for each task." },
  { icon: ImageIcon, title: "Image", accent: "#a855f7", copy: "Turn prompts, references, and concepts into polished visual assets." },
  { icon: Video, title: "Video", accent: "#fb7185", copy: "Create short clips, social cuts, and cinematic experiments from one place." },
  { icon: Mic2, title: "Voice", accent: "#f59e0b", copy: "Plan scripts, narration, podcasts, and voiceover workflows beside your work." },
  { icon: Search, title: "Research", accent: "#60a5fa", copy: "Live web search with sources and a transparent step-by-step work log." },
  { icon: Languages, title: "Translate", accent: "#34d399", copy: "Fast, accurate translation across languages without leaving the workspace." },
  { icon: NotebookPen, title: "Notebooks", accent: "#f97316", copy: "Capture useful ideas and build structured notebooks from your chats." },
  { icon: Library, title: "Library", accent: "#2dd4bf", copy: "Save outputs, organize history, and return to anything you have created." }
];

const benefits = [
  "One subscription for text, image, video, voice, research, translation, and analysis.",
  "Built for creators, students, founders, teams, agencies, and growing businesses.",
  "Simple credit wallet with plans that scale from trial work to high-volume production.",
  "Organize chats, save outputs to Library, and build notebooks from useful ideas."
];

const PLAN_PERKS: Record<string, string[]> = {
  free: ["Every Aria mode", "Pay-as-you-go top-ups", "Community support"],
  starter: ["Every Aria mode", "Top-ups anytime", "Email support"],
  plus: ["Everything in Starter", "Priority model routing", "Email support"],
  pro: ["Everything in Plus", "Highest throughput", "Priority support"],
  power: ["Everything in Pro", "Maximum monthly credits", "Priority support"]
};

function getPlanPerks(planId: string) {
  return PLAN_PERKS[planId] ?? ["Every Aria mode", "Top-ups anytime", "Email support"];
}

const aboutStats = [
  { icon: Layers3, value: "8+", label: "Leading models" },
  { icon: BrainCircuit, value: "3", label: "Branded tiers" },
  { icon: WandSparkles, value: "6", label: "Creation modes" },
  { icon: ShieldCheck, value: "1", label: "Credit wallet" }
];

const quotes = [
  { text: "Stop switching tabs. Start building with one AI command center.", who: "The AriamindX Team" },
  { text: "One subscription, every powerful model, zero context switching.", who: "AriamindX" },
  { text: "Ask once, let every model answer, and get one verified result.", who: "Aria Analyzer" }
];

const audiences = [
  { icon: WandSparkles, label: "Creators", detail: "Campaigns, visuals, scripts, and content systems." },
  { icon: GraduationCap, label: "Students", detail: "Study help, summaries, explanations, and projects." },
  { icon: Building2, label: "Founders", detail: "Research, pitch copy, product thinking, and launch assets." },
  { icon: Users, label: "Teams", detail: "Shared AI workflows for content, support, strategy, and ops." }
];

const heroWords = ["Text", "Image", "Video", "Voice", "Research", "Analysis"];

export function LandingPage({ catalog }: { catalog: ResolvedBillingCatalog }) {
  const scrolled = useScrolled(24);

  return (
    <main className="landing-page">
      <LandingSpaceBackdrop />
      <LandingNav scrolled={scrolled} />

      <section className="landing-hero">

        <motion.div
          className="landing-hero-content"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <motion.p
            className="landing-eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
          >
            AriamindX AI workspace
          </motion.p>
          <TypewriterHeadline />
          <p className="landing-subheadline">
            AriamindX helps creators, students, founders, teams, and businesses generate high-quality content,
            answers, visuals, videos, and voiceovers using the world&apos;s leading AI models.
          </p>

          <div className="landing-hero-actions">
            <Link className="landing-primary-button" href="/login">
              Get started
              <ArrowRight size={18} />
            </Link>
            <Link className="landing-secondary-button" href="/signup">
              Create account
            </Link>
          </div>

          <div className="landing-word-row" aria-label="Supported creation modes">
            {heroWords.map((word, index) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34 + index * 0.06, duration: 0.45 }}
              >
                {word}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </section>

      <section className="landing-logos" aria-label="Models powering AriamindX">
        <p className="landing-logos-label">The models and engines powering every AriamindX answer</p>
        <div className="landing-marquee">
          <div className="landing-marquee-track">
            {[...modelLogos, ...modelLogos].map((model, index) => (
              <article
                className="landing-mcard landing-marquee-card"
                key={`${model.label}-${index}`}
                style={{ "--model-color": model.color } as CSSProperties}
                aria-hidden={index >= modelLogos.length || undefined}
              >
                <span className="landing-mcard-logo">
                  <img src={model.src} alt={`${model.label} logo`} loading="lazy" decoding="async" draggable={false} />
                </span>
                <strong className="landing-mcard-name">{model.label}</strong>
                <span className="landing-mcard-latest">{model.latest}</span>
                <p className="landing-mcard-desc">{model.intro}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-model-section" id="models">
        <SectionHeading
          eyebrow="Model tiers"
          title="Five modes turn provider routing into simple user intent"
          copy="You pick the kind of answer you want; Aria maps it to a mode and routes to the right model behind the surface. Instant speed, a chosen provider, a merged consensus, a side-by-side comparison, or an auto-routed pick, all metered by one credit wallet."
        />
        <div className="landing-tier-rows">
          {tiers.map((tier, index) => (
            <motion.div
              className={`landing-tier-row ${index % 2 === 0 ? "is-flipped" : ""}`}
              style={{ "--model-color": tier.color } as CSSProperties}
              key={tier.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55 }}
            >
              <div className="landing-tier-info">
                <span className="landing-tier-icon">
                  <tier.icon size={22} />
                </span>
                <strong>{tier.name}</strong>
                <em>{tier.tagline}</em>
                <p>{tier.copy}</p>
                <ul className="landing-tier-points">
                  {tier.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
                <div className="landing-tier-models">
                  <span>Routes to</span>
                  <strong>{tier.models}</strong>
                </div>
              </div>
              <div className="landing-tier-diagram">
                <span className="landing-tier-flow-label">{tier.name} workflow</span>
                <TierWorkflow diagram={tier.diagram} color={tier.color} />
              </div>
            </motion.div>
          ))}
        </div>
        <p className="landing-tier-note">
          Users see intent, not model names. Providers, routing, and pricing stay configurable in admin, so the consumer
          surface stays simple while every premium behavior is governed by one credit wallet.
        </p>
      </section>

      <section className="landing-section landing-capability-section" id="features">
        <SectionHeading
          eyebrow="Features"
          title="Text, image, video, voice, research, and storage together"
          copy="AriamindX keeps the creative loop fast: prompt, compare, generate, save, organize, and continue."
        />
        <div className="landing-card-grid">
          {capabilities.map((item, index) => (
            <motion.article
              className="landing-feature-card"
              key={item.title}
              style={{ "--feature-accent": item.accent } as CSSProperties}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ delay: (index % 4) * 0.08, duration: 0.52 }}
              whileHover={{ y: -8 }}
            >
              <span className="landing-feature-glow" aria-hidden="true" />
              <span className="landing-card-icon">
                <item.icon size={22} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <span className="landing-feature-arrow" aria-hidden="true">
                <ArrowRight size={16} />
              </span>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-benefit-band">
        <div>
          <p className="landing-eyebrow">Why it feels easier</p>
          <h2>Stop switching tabs. Start building with one AI command center.</h2>
        </div>
        <div className="landing-benefit-list">
          {benefits.map((benefit) => (
            <motion.div
              className="landing-benefit-item"
              key={benefit}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
            >
              <CheckCircle2 size={18} />
              <span>{benefit}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-about" id="about">
        <motion.div
          className="landing-about-copy"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.55 }}
        >
          <p className="landing-eyebrow">About AriamindX</p>
          <h2>One workspace, every powerful model.</h2>
          <p>
            AriamindX was built on a simple idea: you should not need ten subscriptions and ten open tabs to
            do real work with AI. Text, images, video, voice, research, and translation belong in one calm,
            fast workspace.
          </p>
          <p>
            Modern teams switch constantly between separate AI tools, each with its own login, billing, and
            quirks. AriamindX brings the leading models together behind five clear modes, so you reach for the
            right capability instead of the right app.
          </p>
          <p>
            The difference is in the details: a single credit wallet across every feature, branded tiers that
            stay simple to use, and an analyzer that compares models and verifies answers instead of guessing.
          </p>
        </motion.div>
        <div className="landing-about-stats">
          {aboutStats.map((stat, index) => (
            <motion.div
              className="landing-about-stat"
              key={stat.label}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: index * 0.07, duration: 0.45 }}
            >
              <stat.icon size={20} />
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <QuoteBand />

      <section className="landing-section landing-plan-section" id="plans">
        <SectionHeading
          eyebrow="Plans"
          title="One subscription, every AriamindX feature"
          copy="Pick a monthly credit wallet. Every plan unlocks the full workspace: chat, research, image, video, translate, notebooks, and library."
        />
        <div className="landing-plan-grid">
          {catalog.plans.map((plan, index) => {
            const isPopular = plan.id === "pro";

            return (
              <motion.article
                className={`landing-plan-card ${isPopular ? "is-featured" : ""}`}
                key={plan.id}
                style={{ "--plan-color": plan.accent } as CSSProperties}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ delay: index * 0.05, duration: 0.48 }}
                whileHover={{ y: -9 }}
              >
                <span className="landing-plan-accent" aria-hidden="true" />
                {isPopular ? <span className="landing-plan-badge">Most popular</span> : null}

                <span className="landing-plan-name">{plan.name}</span>

                <div className="landing-plan-price">
                  <strong>{inrFormatter.format(plan.priceInr)}</strong>
                  <span>{plan.priceInr === 0 ? "free forever" : "/ month"}</span>
                </div>

                <p className="landing-plan-credits">
                  <Zap size={14} aria-hidden="true" />
                  {plan.monthlyCredits.toLocaleString("en-IN")} credits / month
                </p>

                <ul className="landing-plan-features">
                  {getPlanPerks(plan.id).map((perk) => (
                    <li key={perk}>
                      <CheckCircle2 size={14} aria-hidden="true" />
                      {perk}
                    </li>
                  ))}
                </ul>

                <Link href={getPlanAuthHref(plan.id)}>
                  Choose plan
                  <ArrowRight size={16} />
                </Link>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="landing-section landing-rate-section">
        <SectionHeading
          eyebrow="Credit use"
          title="Transparent rates across every generation mode"
          copy="Use one balance across the creative stack instead of juggling many disconnected subscriptions."
        />
        <div className="landing-rate-grid">
          {catalog.featureRates.map((rate) => (
            <div className="landing-rate-pill" key={rate.id} style={{ "--rate-color": rate.color } as CSSProperties}>
              <span />
              <strong>{rate.label}</strong>
              <em>{rate.credits} credits</em>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <SectionHeading
          eyebrow="Use cases"
          title="Built for real work, study, launch, and production"
          copy="The workspace adapts to the way different people create, learn, research, and ship."
        />
        <div className="landing-audience-grid">
          {audiences.map((item, index) => (
            <motion.article
              className="landing-audience-card"
              key={item.label}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ delay: index * 0.07 }}
            >
              <item.icon size={21} />
              <strong>{item.label}</strong>
              <span>{item.detail}</span>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <Sparkles size={24} />
        <h2>Create with every powerful model from one place.</h2>
        <p>Start in AriamindX, choose your plan, and continue directly into your AI workspace.</p>
        <div className="landing-hero-actions">
          <Link className="landing-primary-button" href="/login">
            Get started
            <ArrowRight size={18} />
          </Link>
          <Link className="landing-secondary-button" href="#plans">
            View plans
          </Link>
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}

const HEADLINE_SENTENCES = [
  "One AI Workspace.",
  "Every Powerful Model.",
  "Text, Image, Video & Voice.",
  "All in One Place."
];
const HEADLINE_FULL = HEADLINE_SENTENCES.join(" ");

function TypewriterHeadline() {
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setText(HEADLINE_FULL);
      return;
    }

    const full = HEADLINE_SENTENCES[index];
    let delay: number;
    if (!deleting) {
      delay = text.length < full.length ? 52 : 1500;
    } else {
      delay = text.length > 0 ? 26 : 320;
    }

    const timer = setTimeout(() => {
      if (!deleting) {
        if (text.length < full.length) {
          setText(full.slice(0, text.length + 1));
        } else {
          setDeleting(true);
        }
      } else if (text.length > 0) {
        setText(full.slice(0, text.length - 1));
      } else {
        setDeleting(false);
        setIndex((current) => (current + 1) % HEADLINE_SENTENCES.length);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [text, deleting, index, reduceMotion]);

  return (
    <h1 className="landing-hero-typewriter">
      <span className="landing-sr-only">{HEADLINE_FULL}</span>
      <span className="landing-type-text" aria-hidden="true">
        {text}
      </span>
      <span className="landing-type-caret" aria-hidden="true" />
    </h1>
  );
}

type DiagramNode = { icon: typeof Bot; title: string; sub: string };
type DiagramSub = { icon: typeof Bot; label: string; role: string };
type TierDiagram = { main: DiagramNode[]; agentIndex: number; subs: DiagramSub[] };

const WORKFLOW_COLOR_B: Record<string, string> = {
  "#22d3ee": "#25d59b",
  "#a855f7": "#22d3ee",
  "#34d399": "#a3e635",
  "#60a5fa": "#22d3ee",
  "#f59e0b": "#fb7185"
};

function TierWorkflow({ diagram, color }: { diagram: TierDiagram; color: string }) {
  const { main, agentIndex, subs } = diagram;
  const colorB = WORKFLOW_COLOR_B[color] ?? "#eafffb";
  const gradId = `n8nGrad-${color.replace("#", "")}`;

  const NODE_W = 162;
  const NODE_H = 64;
  const GAP_X = 58;
  const ZIG = 40;
  const TOOL_W = 150;
  const TOOL_H = 60;
  const TOOL_GAP = 18;
  const PAD = 16;

  const mainContentW = main.length * NODE_W + (main.length - 1) * GAP_X;
  const toolsContentW = subs.length * TOOL_W + (subs.length - 1) * TOOL_GAP;
  const contentW = Math.max(mainContentW, toolsContentW);
  const width = PAD * 2 + contentW;
  const mainStartX = PAD + (contentW - mainContentW) / 2;
  const toolStartX = PAD + (contentW - toolsContentW) / 2;

  const mainNodes = main.map((node, i) => ({
    node,
    isAgent: i === agentIndex,
    x: mainStartX + i * (NODE_W + GAP_X),
    y: PAD + (i % 2 === 0 ? 0 : ZIG)
  }));

  const toolsTop = PAD + ZIG + NODE_H + 92;
  const height = toolsTop + TOOL_H + PAD;
  const toolNodes = subs.map((sub, k) => ({
    sub,
    x: toolStartX + k * (TOOL_W + TOOL_GAP),
    y: toolsTop
  }));

  const agent = mainNodes[agentIndex];
  const agentCx = agent.x + NODE_W / 2;
  const agentBottom = agent.y + NODE_H;
  const busY = toolsTop - 22;

  const mainPaths = mainNodes.slice(0, -1).map((a, i) => {
    const b = mainNodes[i + 1];
    const x1 = a.x + NODE_W;
    const y1 = a.y + NODE_H / 2;
    const x2 = b.x;
    const y2 = b.y + NODE_H / 2;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`;
  });

  const toolPaths = toolNodes.map((t) => {
    const tx = t.x + TOOL_W / 2;
    return `M ${agentCx} ${agentBottom} V ${busY} H ${tx} V ${t.y}`;
  });

  return (
    <div className="n8n" style={{ "--model-color": color } as CSSProperties}>
      <svg className="n8n-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={width} y2="0">
            <stop offset="0%" stopColor={color} />
            <stop offset="50%" stopColor={colorB} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>

        {mainPaths.map((d, i) => (
          <path key={`w${i}`} className="n8n-wire" d={d} stroke={`url(#${gradId})`} />
        ))}
        {toolPaths.map((d, i) => (
          <path key={`tw${i}`} className="n8n-wire n8n-wire-tool" d={d} stroke={`url(#${gradId})`} />
        ))}
        {mainPaths.map((d, i) => (
          <path
            key={`p${i}`}
            className="n8n-pulse"
            d={d}
            stroke={`url(#${gradId})`}
            style={{ animationDelay: `${i * 0.6}s` } as CSSProperties}
          />
        ))}
        {toolPaths.map((d, i) => (
          <path
            key={`tp${i}`}
            className="n8n-pulse n8n-pulse-tool"
            d={d}
            stroke={`url(#${gradId})`}
            style={{ animationDelay: `${mainPaths.length * 0.6 + i * 0.25}s` } as CSSProperties}
          />
        ))}

        {mainNodes.map(({ node, isAgent, x, y }) => (
          <foreignObject key={node.title} x={x} y={y} width={NODE_W} height={NODE_H}>
            <div className={`n8n-fo ${isAgent ? "is-agent" : ""}`}>
              <span className="n8n-node-icon">
                <node.icon size={16} />
              </span>
              <span className="n8n-node-text">
                <strong>{node.title}</strong>
                <small>{node.sub}</small>
              </span>
            </div>
          </foreignObject>
        ))}
        {toolNodes.map(({ sub, x, y }) => (
          <foreignObject key={sub.label} x={x} y={y} width={TOOL_W} height={TOOL_H}>
            <div className="n8n-fo n8n-fo-tool">
              <span className="n8n-node-icon">
                <sub.icon size={13} />
              </span>
              <span className="n8n-node-text">
                <strong>{sub.label}</strong>
                <small>{sub.role}</small>
              </span>
            </div>
          </foreignObject>
        ))}
      </svg>
    </div>
  );
}

function LandingNav({ scrolled }: { scrolled: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu once the viewport grows back to desktop width.
  useEffect(() => {
    if (!menuOpen) return;
    const onResize = () => {
      if (window.innerWidth > 720) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`landing-nav ${scrolled ? "is-scrolled" : ""} ${menuOpen ? "is-open" : ""}`}>
      <div className="landing-nav-inner">
        <Link className="landing-brand" href="/" onClick={closeMenu}>
          <AionLogo size={34} />
          <span>
            <strong>AriamindX</strong>
            <small>By JB Crownstone</small>
          </span>
        </Link>
        <button
          type="button"
          className="landing-nav-toggle"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav aria-label="Landing navigation" className={menuOpen ? "is-open" : ""}>
          <a href="#models" onClick={closeMenu}>Models</a>
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#about" onClick={closeMenu}>About</a>
          <a href="#plans" onClick={closeMenu}>Plans</a>
          <Link href="/login" onClick={closeMenu}>Login</Link>
          <Link className="landing-nav-cta" href="/login" onClick={closeMenu}>
            Get started
            <ArrowRight size={15} />
          </Link>
        </nav>
      </div>
    </header>
  );
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COLORS = ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#eaf1ff", "#c7d8ff", "#ffe2c4"];

function LandingSpaceBackdrop() {
  const reduceMotion = useReducedMotion();

  const stars = useMemo(() => {
    const rand = mulberry32(20260615);
    return Array.from({ length: 260 }, () => {
      // bias toward tiny, faint stars; a few are larger and brighter
      const r = rand();
      const big = r > 0.92;
      const size = big ? 1.6 + rand() * 1.6 : 0.5 + rand() * 1.1;
      const opacity = big ? 0.7 + rand() * 0.3 : 0.18 + rand() * 0.42;
      return {
        x: rand() * 100,
        y: rand() * 100,
        size,
        duration: 2.4 + rand() * 5.2,
        delay: rand() * 7,
        opacity,
        color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)]
      };
    });
  }, []);

  const sparks = useMemo(() => {
    const rand = mulberry32(771237);
    return Array.from({ length: 8 }, () => ({
      x: 5 + rand() * 90,
      y: 4 + rand() * 92,
      size: 2.2 + rand() * 2.4,
      duration: 2.8 + rand() * 3.6,
      delay: rand() * 5
    }));
  }, []);

  return (
    <div className="landing-space" aria-hidden="true">
      <div className="landing-space-base" />
      <div className="landing-nebula landing-nebula-1" />
      <div className="landing-nebula landing-nebula-2" />

      <div className="landing-starfield">
        {stars.map((star, index) => (
          <span
            key={index}
            className="landing-star"
            style={
              {
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                background: star.color,
                "--star-opacity": star.opacity,
                animationDuration: reduceMotion ? "0s" : `${star.duration}s`,
                animationDelay: reduceMotion ? "0s" : `${star.delay}s`
              } as CSSProperties
            }
          />
        ))}
      </div>

      {sparks.map((spark, index) => (
        <motion.span
          key={index}
          className="landing-star-spark"
          style={{ left: `${spark.x}%`, top: `${spark.y}%`, width: `${spark.size}px`, height: `${spark.size}px` } as CSSProperties}
          animate={reduceMotion ? undefined : { opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: spark.duration, delay: spark.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

    </div>
  );
}

function QuoteBand() {
  const reduceMotion = useReducedMotion();
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduceMotion) {
      setText(quotes[0].text);
      return;
    }

    const full = quotes[index].text;
    let delay: number;
    if (!deleting) {
      delay = text.length < full.length ? 42 : 2200;
    } else {
      delay = text.length > 0 ? 22 : 360;
    }

    const timer = setTimeout(() => {
      if (!deleting) {
        if (text.length < full.length) {
          setText(full.slice(0, text.length + 1));
        } else {
          setDeleting(true);
        }
      } else if (text.length > 0) {
        setText(full.slice(0, text.length - 1));
      } else {
        setDeleting(false);
        setIndex((current) => (current + 1) % quotes.length);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [text, deleting, index, reduceMotion]);

  const activeIndex = reduceMotion ? 0 : index;
  const quote = quotes[activeIndex];
  const typed = reduceMotion ? quote.text : text;
  const complete = typed.length === quote.text.length;

  return (
    <section className="landing-quote">
      <QuoteIcon className="landing-quote-mark" size={40} aria-hidden="true" />
      <blockquote>
        <p>
          <span className="landing-sr-only">{quote.text}</span>
          <span className="landing-quote-typed" aria-hidden="true">{typed}</span>
          {!reduceMotion && <span className="landing-quote-caret" aria-hidden="true" />}
        </p>
        <cite style={{ opacity: complete ? 1 : 0 }}>{quote.who}</cite>
      </blockquote>
      <motion.span
        className="landing-quote-underline"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        aria-hidden="true"
      />
    </section>
  );
}

function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <Link className="landing-brand" href="/">
          <AionLogo size={30} />
          <span>
            <strong>AriamindX</strong>
            <small>By JB Crownstone</small>
          </span>
        </Link>
        <nav aria-label="Footer navigation">
          <a href="#models">Models</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#plans">Plans</a>
          <Link href="/login">Login</Link>
          <Link href="/signup">Create account</Link>
        </nav>
      </div>
      <p className="landing-footer-copy">&copy; {year} AriamindX by JB Crownstone. Every powerful model, one workspace.</p>
    </footer>
  );
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <motion.div
      className="landing-section-heading"
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.45 }}
      transition={{ duration: 0.55 }}
    >
      <p className="landing-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <span>{copy}</span>
    </motion.div>
  );
}

function useScrolled(threshold: number) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}

function getPlanAuthHref(planId: BillingPlanId) {
  const redirect = `/billing?plan=${planId}`;

  return `/login?redirect=${encodeURIComponent(redirect)}`;
}
