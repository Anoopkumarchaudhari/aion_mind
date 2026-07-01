"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useAnimationFrame,
  useMotionTemplate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionStyle,
  type Variants
} from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Menu,
  Pause,
  Play,
  Sparkles,
  Star,
  X
} from "lucide-react";

/* ============================================================ tokens === */

const EASE = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 44 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } }
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } }
};

/* ============================================================== data === */

// Media that "emerges" from the vanishing point on scroll. x/y are the resting
// offsets (vw/vh) from screen center; z is resting depth (px, higher = nearer);
// s is resting scale. Deeper tiles (lower z) emerge first.
const EMERGE_TILES: Array<{
  src: string;
  video?: string;
  chip: string;
  x: number;
  y: number;
  z: number;
  s: number;
}> = [
  { src: "/image_sidebar/image9.jpg", chip: "Seedream 4.5", x: -22, y: -18, z: 220, s: 1.0 },
  { src: "/image_sidebar/image12.png", chip: "Nano Banana Pro", x: 24, y: -20, z: 180, s: 0.95 },
  { src: "/landing/artists/image9.jpg", video: "/landing/lotus.mp4", chip: "VEO 3 FAST", x: -38, y: 12, z: 90, s: 0.8 },
  { src: "/image_sidebar/image21.avif", chip: "SORA 2 PRO", x: 40, y: 16, z: 70, s: 0.82 },
  { src: "/image_sidebar/image1.jpg", chip: "gpt-image-1", x: -12, y: 26, z: 150, s: 0.9 },
  { src: "/image_sidebar/image20.png", chip: "Runware 400", x: 16, y: 30, z: 110, s: 0.85 },
  { src: "/image_sidebar/image8.avif", chip: "Phoenix", x: -52, y: -6, z: -60, s: 0.62 },
  { src: "/image_sidebar/gpt-image4.jpg", chip: "Lucid Origin", x: 54, y: -2, z: -60, s: 0.62 },
  { src: "/image_sidebar/image11.png", chip: "Nano Banana", x: -6, y: -32, z: 30, s: 0.7 },
  { src: "/landing/artists/image12.png", video: "/landing/lotus.mp4", chip: "LTX-2 PRO", x: 10, y: 34, z: -90, s: 0.55 },
  { src: "/image_sidebar/image4.png", chip: "Kling Pro", x: -30, y: 2, z: 300, s: 0.72 },
  { src: "/image_sidebar/image7.avif", chip: "Seedream 4.5", x: 30, y: 6, z: 260, s: 0.7 }
];

const STATS = [
  { value: "12+", label: "AI MODELS INTEGRATED", color: "var(--sl-cyan)" },
  { value: "2", label: "IMAGE & VIDEO MODES", color: "var(--sl-yellow)" },
  { value: "16:9", label: "WIDESCREEN READY", color: "var(--sl-green)" },
  { value: "∞", label: "VARIATIONS TO EXPLORE", color: "var(--sl-pink)" }
];

const TYPEWRITER_PROMPTS = [
  "Fashion portrait of a model with floral couture, studio light",
  "Chrome soft-serve dessert, glossy metallic texture, dark set",
  "A rain-glossed neon city street at night, cinematic wide angle"
];

const FEATURES = [
  {
    heading: "CREATE IMAGES\nWITHOUT LIMITS",
    body: "Generate high-quality visuals from simple prompts or custom models, tailored to your aesthetic and built to scale across concepts, styles, and use cases.",
    media: "typewriter" as const,
    src: "/image_sidebar/image4.png",
    video: "",
    chips: [] as string[],
    align: "media-right" as const,
    overlay: ""
  },
  {
    heading: "MOVING\nVISUALS",
    body: "Turn static ideas into dynamic video content with AI-driven animation and motion tools designed for storytelling, social, and product experiences.",
    media: "video" as const,
    src: "/landing/artists/image9.jpg",
    video: "/landing/lotus.mp4",
    chips: ["VEO 3.1", "KLING PRO", "RUNWARE"],
    align: "media-left" as const,
    overlay: ""
  },
  {
    heading: "ELEVATE QUALITY\nAT ANY SIZE",
    body: "Boost resolution and clarity without sacrificing detail, preparing assets for print, high-resolution displays, and professional delivery.",
    media: "image" as const,
    src: "/image_sidebar/image12.png",
    video: "",
    chips: [] as string[],
    align: "media-right" as const,
    overlay: "UPSCALING"
  }
];

const PROMPT_GALLERY = [
  { src: "/image_sidebar/image1.jpg", chip: "Nano Banana Pro", caption: "Chrome soft-serve dessert with cherry, wafer sticks, and straw, glossy metallic texture, dramatic studio lighting, surreal luxury product photography." },
  { src: "/image_sidebar/image8.avif", chip: "Runware 400", caption: "Elegant rider wearing a tailored green suit and bowler hat mounted on a glossy black horse in a vast desert, high-fashion editorial photography." },
  { src: "/image_sidebar/image11.png", chip: "gpt-image-1", caption: "Plush sculptural pink sofa centered in a minimalist studio setting, high-end product photography, modern editorial aesthetic." },
  { src: "/image_sidebar/image20.png", chip: "Veo 3.1", caption: "Bioluminescent forest at dusk, volumetric fog, drifting particles, cinematic depth and colour grade." },
  { src: "/image_sidebar/image21.avif", chip: "Gemini 3 Pro", caption: "Futuristic glass library in a rain-washed city, warm interior glow, ultra-wide architectural render." },
  { src: "/image_sidebar/image14.png", chip: "Runware 100", caption: "Serene floating garden above monsoon clouds, luminous atmosphere, painterly light." }
];

const TUTORIALS = [
  { src: "/image_sidebar/image2.jpeg", title: "GETTING STARTED WITH ARIA STUDIO", color: "var(--sl-green)" },
  { src: "/image_sidebar/gpt-image4.jpg", title: "IMAGE MODELS EXPLAINED", color: "var(--sl-yellow)" },
  { src: "/image_sidebar/image7.avif", title: "HOW TO WRITE GREAT PROMPTS", color: "var(--sl-pink)" }
];

const ARTISTS = [
  { src: "/landing/artists/image9.jpg", name: "MIA FORREST", role: "Multidisciplinary Artist", color: "var(--sl-pink)" },
  { src: "/landing/artists/image21.avif", name: "MATEO MEJIA", role: "Filmmaker", color: "var(--sl-green)" },
  { src: "/landing/artists/image12.png", name: "JOYCE NG", role: "Digital Artist", color: "var(--sl-pink)" },
  { src: "/landing/artists/lion-in-wimage5.webp", name: "ARI KOMA", role: "Concept Designer", color: "var(--sl-cyan)" }
];

const LOGOS = [
  { src: "/model logo/openai.webp", label: "OpenAI" },
  { src: "/model logo/claude-ai.webp", label: "Claude" },
  { src: "/model logo/gemini.jpg", label: "Gemini" },
  { src: "/model logo/DeepSeek-Emblem.png", label: "DeepSeek" },
  { src: "/model logo/Runware.jpg", label: "Runware" },
  { src: "/model logo/tavily.png", label: "Tavily" }
];

const FOOTER_COLUMNS = [
  { title: "Image", links: ["Image Generator", "Background Remover", "Train Your Own Model"] },
  { title: "Video", links: ["AI Video Generator", "Image to Video", "Motion Tools"] },
  { title: "Models", links: ["OpenAI", "Runware", "Google Veo", "Nano Banana"] },
  { title: "Use cases", links: ["Art Generator", "Social Media Posts", "Storyboards", "Characters"] },
  { title: "Support", links: ["Contact", "Pricing", "Education Hub", "Creator Program"] }
];

/* ============================================================== root === */

export function StudioLanding() {
  return (
    <div className="sl-root">
      <StudioLandingStyles />
      <Navbar />
      <Hero />
      <StatsMarquee />
      <Features />
      <PromptGallery />
      <Tutorials />
      <ArtistStories />
      <ScaleSection />
      <LandingFooter />
    </div>
  );
}

/* ============================================================= navbar === */

const NAV_LINKS = [
  {
    label: "Create",
    items: [
      { label: "Image Generator", href: "/studio/create" },
      { label: "Video Generator", href: "/studio/create?tab=video" },
      { label: "Upscale & Enhance", href: "/studio/create" }
    ]
  },
  {
    label: "Learn",
    items: [
      { label: "Tutorials", href: "#tutorials" },
      { label: "Prompt Gallery", href: "#gallery" },
      { label: "Artist Stories", href: "#artists" }
    ]
  }
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sl-nav ${scrolled ? "is-scrolled" : ""}`}>
      <Link href="/chat" className="sl-nav-logo" aria-label="Back to Aria">
        <Sparkles size={18} /> ARIA STUDIO
      </Link>

      <nav className="sl-nav-links" onMouseLeave={() => setOpenMenu(null)}>
        {NAV_LINKS.map((link) => (
          <div
            key={link.label}
            className="sl-nav-item"
            onMouseEnter={() => setOpenMenu(link.label)}
          >
            <button type="button" className="sl-nav-trigger">
              {link.label}
              <ChevronDown size={15} className={openMenu === link.label ? "is-open" : ""} />
            </button>
            <AnimatePresence>
              {openMenu === link.label ? (
                <motion.div
                  className="sl-nav-panel"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18 }}
                >
                  {link.items.map((item) => (
                    <Link key={item.label} href={item.href} className="sl-nav-panel-link">
                      {item.label}
                    </Link>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ))}
        <a href="#gallery" className="sl-nav-trigger">Gallery</a>
        <Link href="/pricing" className="sl-nav-trigger">Pricing</Link>
        <Link href="/contact" className="sl-nav-trigger">Contact</Link>
      </nav>

      <div className="sl-nav-cta">
        <a href="#tutorials" className="sl-btn sl-btn-ghost sl-btn-sm">Tutorial</a>
        <Link href="/studio/create" className="sl-btn sl-btn-primary sl-btn-sm">Open Studio</Link>
        <button
          type="button"
          className="sl-nav-burger"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            className="sl-nav-mobile"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <button
              type="button"
              className="sl-nav-mobile-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={24} />
            </button>
            <Link href="/studio/create" onClick={() => setMobileOpen(false)}>Image Generator</Link>
            <Link href="/studio/create?tab=video" onClick={() => setMobileOpen(false)}>Video Generator</Link>
            <a href="#gallery" onClick={() => setMobileOpen(false)}>Gallery</a>
            <a href="#tutorials" onClick={() => setMobileOpen(false)}>Tutorials</a>
            <Link href="/pricing" onClick={() => setMobileOpen(false)}>Pricing</Link>
            <Link href="/contact" onClick={() => setMobileOpen(false)}>Contact</Link>
            <Link href="/studio/create" className="sl-btn sl-btn-primary" onClick={() => setMobileOpen(false)}>
              Open Studio <ArrowRight size={18} />
            </Link>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

/* =============================================================== hero === */

function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // Pin the hero across extra scroll and scrub the fly-in to that progress.
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = scrollYProgress;

  // Phase A: fly INTO the tunnel — the room dollies forward and fades past camera.
  // Fly the room forward past the camera. translateZ is a transform, which is
  // SAFE on a preserve-3d element — unlike opacity, which would flatten it. The
  // room disappears naturally once z passes the perspective distance.
  const roomZ = useTransform(p, [0, 0.5], [0, 1600]);
  const copyOpacity = useTransform(p, [0.08, 0.3], [1, 0]);
  const copyY = useTransform(p, [0, 0.3], [0, -80]);
  const hintOpacity = useTransform(p, [0, 0.06], [1, 0]);

  if (reduce) {
    // Reduced motion: static tunnel frame + copy, no pin/scrub.
    return (
      <section className="sl-hero-scroll sl-hero-static">
        <div className="sl-hero-pin">
          <div className="sl-hero-stage" aria-hidden="true">
            <div className="sl-scene">
              <RoomWalls reduce />
            </div>
          </div>
          <div className="sl-copy-wrap"><HeroCopy /></div>
        </div>
      </section>
    );
  }

  return (
    <section className="sl-hero-scroll" ref={ref}>
      <div className="sl-hero-pin">
        <div className="sl-hero-stage" aria-hidden="true">
          <div className="sl-scene">
            <RoomWalls style={{ z: roomZ }} />
            <MediaEmerge progress={p} />
          </div>
        </div>

        <motion.div className="sl-copy-wrap" style={{ opacity: copyOpacity, y: copyY }}>
          <HeroCopy />
        </motion.div>

        <motion.div className="sl-scroll-hint" style={{ opacity: hintOpacity }} aria-hidden="true">
          Scroll to explore
        </motion.div>
      </div>
    </section>
  );
}

function HeroCopy() {
  return (
    <div className="sl-hero-copy">
      <span className="sl-eyebrow"><Sparkles size={14} /> Aria Studio</span>
      <h1 className="sl-hero-title">
        THE CREATOR-FIRST<br />GENERATIVE AI STUDIO
      </h1>
      <div className="sl-hero-actions">
        <Link href="/studio/create" className="sl-btn sl-btn-primary">Start now</Link>
        <Link href="/studio/create?tab=video" className="sl-btn sl-btn-ghost">Try video</Link>
      </div>
    </div>
  );
}

// Renders a wall as evenly-stacked rows of one repeated phrase. Each row is a
// single non-wrapping line, so phrases never break mid-word (no zig-zag) and the
// rows stay parallel — the excess is clipped by the wall's overflow:hidden.
function WallText({ phrase, rows, per }: { phrase: string; rows: number; per: number }) {
  const line = Array.from({ length: per }, () => phrase).join("  ");
  return (
    <div className="sl-rows">
      {Array.from({ length: rows }).map((_, i) => (
        <span key={i}>{line}</span>
      ))}
    </div>
  );
}

// Phase A — interior "box of words" in CSS 3D, slowly drifting.
function RoomWalls({ reduce = false, style }: { reduce?: boolean; style?: MotionStyle }) {
  return (
      <motion.div
        className="sl-box"
        style={style}
        animate={reduce ? undefined : { rotateY: [-3, 3, -3], rotateX: [-2, 2, -2] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="sl-face sl-face-back">
          <span className="sl-back-word">
            {"ARIAMINDX AI".split("").map((ch, i) => (
              <b key={i}>{ch === " " ? " " : ch}</b>
            ))}
          </span>
        </div>
        <div className="sl-face sl-face-left"><WallText phrase="YOUR IDEAS" rows={5} per={2} /></div>
        <div className="sl-face sl-face-right"><WallText phrase="YOUR TOOLS" rows={5} per={2} /></div>
        <div className="sl-face sl-face-floor"><WallText phrase="YOURS TO CREATE" rows={6} per={2} /></div>
        <div className="sl-face sl-face-ceil"><WallText phrase="IMAGINE ANYTHING" rows={6} per={2} /></div>
      </motion.div>
  );
}

// Phase B — media continuously streams out of the vanishing point. One shared,
// always-advancing "flow" value drives it: idle time advances it on its own AND
// scrolling advances it faster. Because it's continuous and never reset, the
// stream keeps flowing from the CURRENT position — no snap back to center.
const IDLE_SPEED = 0.14; // cycles per second while idle
const SCROLL_GAIN = 2.6; // extra cycles advanced across the emergence scroll zone

function MediaEmerge({ progress }: { progress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const flow = useMotionValue(0);
  const last = useRef(0);
  const inWindowRef = useRef(false);
  const [inWindow, setInWindow] = useState(false);

  // Scrolling pushes the flow forward (either direction), on top of idle drift.
  useMotionValueEvent(progress, "change", (v) => {
    const win = v > 0.12 && v < 0.92;
    if (win !== inWindowRef.current) {
      inWindowRef.current = win;
      setInWindow(win);
    }
    const delta = v - last.current;
    last.current = v;
    if (win) flow.set(flow.get() + Math.abs(delta) * SCROLL_GAIN);
  });

  // Idle drift — keeps the stream alive with motion even when the user stops,
  // continuing from wherever the flow currently is.
  useAnimationFrame((_, dtMs) => {
    if (inWindowRef.current) flow.set(flow.get() + (dtMs / 1000) * IDLE_SPEED);
  });

  return (
    <div className="sl-media-layer" aria-hidden="true">
      {EMERGE_TILES.map((tile, i) => (
        <EmergeTile key={tile.chip + i} tile={tile} index={i} flow={flow} inWindow={inWindow} />
      ))}
    </div>
  );
}

function EmergeTile({
  tile,
  index,
  flow,
  inWindow
}: {
  tile: (typeof EMERGE_TILES)[number];
  index: number;
  flow: ReturnType<typeof useMotionValue<number>>;
  inWindow: boolean;
}) {
  // Each tile rides the shared flow at its own phase offset, so they pour out one
  // after another. The fractional part loops seamlessly (opacity 0 at both ends).
  const offset = index / EMERGE_TILES.length;
  const phase = useTransform(flow, (v) => {
    const u = (v + offset) % 1;
    return u < 0 ? u + 1 : u;
  });
  const tz = useTransform(phase, [0, 1], [-1700, 560]);
  const tx = useTransform(phase, [0, 1], [0, tile.x]);
  const ty = useTransform(phase, [0, 1], [0, tile.y]);
  const phaseOpacity = useTransform(phase, [0, 0.12, 0.72, 1], [0, 1, 1, 0]);
  const transform = useMotionTemplate`translate(-50%, -50%) translateX(${tx}vw) translateY(${ty}vh) translateZ(${tz}px)`;

  return (
    <motion.div
      className="sl-emerge-tile"
      style={{ transform, opacity: inWindow ? phaseOpacity : 0 }}
    >
      {tile.video ? (
        <video src={tile.video} poster={tile.src} autoPlay muted loop playsInline preload="none" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tile.src} alt="" loading="lazy" />
      )}
      <span className="sl-chip sl-chip-onimg">{tile.chip}</span>
    </motion.div>
  );
}

/* ====================================================== stats marquee === */

function StatsMarquee() {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const halfRef = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    const measure = () => {
      if (trackRef.current) halfRef.current = trackRef.current.scrollWidth / 2;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useAnimationFrame((_, delta) => {
    if (reduce || dragging.current || !halfRef.current) return;
    let next = x.get() - (delta / 1000) * 60; // 60px/s
    if (next <= -halfRef.current) next += halfRef.current;
    x.set(next);
  });

  const items = [...STATS, ...STATS, ...STATS];

  return (
    <section className="sl-marquee-wrap" aria-label="Platform stats">
      <div className="sl-marquee-persp">
        <motion.div
          ref={trackRef}
          className="sl-marquee-track"
          style={{ x }}
          drag={reduce ? false : "x"}
          dragConstraints={{ left: -99999, right: 99999 }}
          dragElastic={0}
          dragMomentum={false}
          onDragStart={() => (dragging.current = true)}
          onDragEnd={() => {
            dragging.current = false;
            const h = halfRef.current;
            if (h) {
              let v = x.get();
              while (v <= -h) v += h;
              while (v > 0) v -= h;
              x.set(v);
            }
          }}
        >
          {items.map((stat, i) => (
            <div className="sl-stat" key={i} style={{ color: stat.color }}>
              <span className="sl-stat-value">{stat.value}</span>
              <span className="sl-stat-label">{stat.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================ features === */

function Features() {
  return (
    <div className="sl-features">
      {FEATURES.map((f) => (
        <FeatureSplit key={f.heading} feature={f} />
      ))}
    </div>
  );
}

function FeatureSplit({ feature }: { feature: (typeof FEATURES)[number] }) {
  return (
    <motion.section
      className={`sl-feature ${feature.align}`}
      variants={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
    >
      <motion.div className="sl-feature-copy" variants={fadeUp}>
        <h2 className="sl-h2">
          {feature.heading.split("\n").map((line) => (
            <span key={line}>{line}<br /></span>
          ))}
        </h2>
        <p className="sl-feature-body">{feature.body}</p>
        <div className="sl-feature-actions">
          <Link href="/studio/create" className="sl-btn sl-btn-primary">Start now</Link>
          <Link href="/studio/create" className="sl-btn sl-btn-ghost">Learn more</Link>
        </div>
      </motion.div>
      <motion.div className="sl-feature-visual" variants={fadeUp}>
        <MediaFrame feature={feature} />
      </motion.div>
    </motion.section>
  );
}

function MediaFrame({ feature }: { feature: (typeof FEATURES)[number] }) {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const isVideo = feature.media === "video" && Boolean(feature.video);
  const [paused, setPaused] = useState(reduce);

  function toggleVideo() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  }

  return (
    <div className="sl-media-frame">
      {isVideo ? (
        <video
          ref={videoRef}
          className="sl-media-img"
          src={feature.video}
          poster={feature.src}
          autoPlay={!reduce}
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={feature.src} alt={feature.heading.replace("\n", " ")} className="sl-media-img" />
      )}

      {feature.overlay ? <span className="sl-media-overlay">{feature.overlay}</span> : null}

      {feature.media === "typewriter" ? (
        <div className="sl-prompt-bar"><TypewriterPrompt /></div>
      ) : null}

      {feature.chips.length ? (
        <div className="sl-media-chips">
          {feature.chips.map((c) => (
            <span className="sl-chip" key={c}>{c}</span>
          ))}
        </div>
      ) : null}

      {isVideo ? (
        <button
          type="button"
          className="sl-media-ctrl"
          onClick={toggleVideo}
          aria-label={paused ? "Play" : "Pause"}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
          {paused ? "Play" : "Pause"}
        </button>
      ) : null}
    </div>
  );
}

function TypewriterPrompt() {
  const reduce = useReducedMotion();
  const [text, setText] = useState(TYPEWRITER_PROMPTS[0]);
  const state = useRef({ p: 0, i: TYPEWRITER_PROMPTS[0].length, dir: -1 });

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => {
      const s = state.current;
      s.i += s.dir;
      if (s.i <= 0) {
        s.dir = 1;
        s.i = 0;
        s.p = (s.p + 1) % TYPEWRITER_PROMPTS.length;
      } else if (s.i >= TYPEWRITER_PROMPTS[s.p].length) {
        s.dir = -1;
        s.i = TYPEWRITER_PROMPTS[s.p].length;
      }
      setText(TYPEWRITER_PROMPTS[s.p].slice(0, s.i));
    }, 55);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <span className="sl-typewriter">
      {text}
      <span className="sl-caret" />
    </span>
  );
}

/* ====================================================== prompt gallery === */

function PromptGallery() {
  return (
    <section className="sl-pgallery" id="gallery">
      <motion.div
        className="sl-pgrid"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
      >
        {PROMPT_GALLERY.map((item) => (
          <motion.figure className="sl-pcard" key={item.src} variants={fadeUp}>
            <div className="sl-pcard-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.caption} loading="lazy" />
              <span className="sl-chip sl-chip-onimg">{item.chip}</span>
            </div>
            <figcaption className="sl-pcard-caption">{item.caption}</figcaption>
          </motion.figure>
        ))}
      </motion.div>
    </section>
  );
}

/* =========================================================== tutorials === */

function Tutorials() {
  const railRef = useRef<HTMLDivElement>(null);
  const scrollBy = () => railRef.current?.scrollBy({ left: 360, behavior: "smooth" });
  return (
    <section className="sl-tutorials" id="tutorials">
      <div className="sl-tut-head">
        <h2 className="sl-h2 sl-h2-sm">TUTORIALS</h2>
        <Link href="/studio/create" className="sl-viewall">View all <ChevronRight size={15} /></Link>
      </div>
      <div className="sl-tut-rail-wrap">
        <div className="sl-tut-rail" ref={railRef}>
          {TUTORIALS.map((t) => (
            <article className="sl-tut-card" key={t.title}>
              <div className="sl-tut-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.src} alt="" loading="lazy" />
              </div>
              <div className="sl-tut-block" style={{ background: t.color }}>{t.title}</div>
            </article>
          ))}
        </div>
        <button type="button" className="sl-tut-next" onClick={scrollBy} aria-label="Next tutorials">
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  );
}

/* ====================================================== artist stories === */

function ArtistStories() {
  return (
    <section className="sl-artists" id="artists">
      <h2 className="sl-mega">
        <Star className="sl-mega-star" size={54} fill="currentColor" />RTIST STORIES
      </h2>
      <motion.div
        className="sl-artist-row"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        {ARTISTS.map((a) => (
          <motion.article className="sl-artist-card" key={a.name} variants={fadeUp}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.src} alt={a.name} loading="lazy" />
            <div className="sl-artist-meta">
              <span className="sl-artist-name" style={{ color: a.color }}>{a.name}</span>
              <span className="sl-artist-role">{a.role}</span>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}

/* =========================================================== scale === */

function ScaleSection() {
  return (
    <section className="sl-scale">
      <motion.h2
        className="sl-scale-heading"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
      >
        THE AI CREATIVE PLATFORM<br />BUILT FOR SCALE
      </motion.h2>
      <p className="sl-scale-sub">
        See how leading teams use Aria&apos;s AI creative suite to scale campaigns,
        streamline video production, and reduce content costs.
      </p>
      <div className="sl-logo-wall">
        {LOGOS.map((logo) => (
          <div className="sl-logo-tile" key={logo.label} title={logo.label}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo.src} alt={logo.label} loading="lazy" />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================= footer === */

function LandingFooter() {
  return (
    <footer className="sl-footer">
      <div className="sl-footer-cols">
        {FOOTER_COLUMNS.map((col) => (
          <div className="sl-footer-col" key={col.title}>
            <h4>{col.title}</h4>
            {col.links.map((l) => (
              <Link href="/studio/create" key={l} className="sl-footer-link">{l}</Link>
            ))}
          </div>
        ))}
      </div>
      <div className="sl-cta-band">
        <span>Your next image or video is one prompt away.</span>
        <Link href="/studio/create" className="sl-btn sl-btn-primary">Open Studio <ArrowRight size={18} /></Link>
      </div>
      <div className="sl-wordmark">ARIA STUDIO</div>
      <div className="sl-footer-bar">
        <span>Privacy Policy · Terms of Service · Cookie Policy</span>
        <span>© 2026 Aria Studio. All rights reserved.</span>
      </div>
    </footer>
  );
}

/* ============================================================= styles === */

function StudioLandingStyles() {
  return <style dangerouslySetInnerHTML={{ __html: STYLES }} />;
}

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap');

.sl-root {
  --sl-bg: #000000;
  --sl-fg: #ffffff;
  --sl-muted: #a1a1aa;
  --sl-purple: #6d55e6;
  --sl-cyan: #40dcfa;
  --sl-yellow: #f8c839;
  --sl-green: #13ff5c;
  --sl-pink: #ed1882;
  --sl-border: rgba(255,255,255,0.14);
  --sl-display: 'Anton','Archivo Black',Impact,sans-serif;
  --sl-body: 'Inter',ui-sans-serif,system-ui,sans-serif;
  position: relative;
  min-height: 100dvh;
  /* clip (not hidden) so this element does NOT become a scroll container —
     otherwise it breaks the sticky pin and freezes window-based useScroll. */
  overflow-x: clip;
  background: var(--sl-bg);
  color: var(--sl-fg);
  font-family: var(--sl-body);
}
/* Let the window/document be the single scroller: clip horizontally without
   coercing overflow-y to auto (which would make <body> the scroll container). */
body:has(.sl-root) { height: auto; min-height: 100%; overflow-x: clip; overflow-y: visible; background: #000; }
.mode-root:has(.sl-root) { height: auto; min-height: 100dvh; overflow: visible; }
.sl-root img { display: block; }
.sl-root ::selection { background: var(--sl-purple); color: #fff; }

/* buttons */
.sl-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 13px 28px; border-radius: 999px; font-weight: 600; font-size: 15px;
  text-decoration: none; cursor: pointer; border: 1px solid transparent;
  transition: transform .2s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.sl-btn-primary { background: #fff; color: #000; }
.sl-btn-primary:hover { transform: scale(1.03); box-shadow: 0 10px 30px -8px rgba(255,255,255,0.4); }
.sl-btn-ghost { background: transparent; color: #fff; border-color: rgba(255,255,255,0.4); }
.sl-btn-ghost:hover { border-color: #fff; background: rgba(255,255,255,0.08); }
.sl-btn-sm { padding: 9px 18px; font-size: 14px; }

/* ---------- navbar ---------- */
.sl-nav {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  display: flex; align-items: center; justify-content: space-between;
  gap: 20px; height: 68px; padding: 0 clamp(18px,4vw,40px);
  background: transparent; border-bottom: 1px solid transparent;
  transition: background .3s ease, border-color .3s ease, backdrop-filter .3s ease;
}
.sl-nav.is-scrolled { background: rgba(0,0,0,0.55); backdrop-filter: blur(14px); border-bottom-color: var(--sl-border); }
.sl-nav-logo { display: inline-flex; align-items: center; gap: 8px; color: #fff; text-decoration: none; font-family: var(--sl-display); font-size: 1.2rem; letter-spacing: 0.02em; }
.sl-nav-logo svg { color: var(--sl-purple); }
.sl-nav-links { display: flex; align-items: center; gap: 6px; }
.sl-nav-item { position: relative; }
.sl-nav-trigger {
  display: inline-flex; align-items: center; gap: 5px;
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,0.85); font-family: var(--sl-body); font-size: 0.95rem; font-weight: 500;
  padding: 9px 12px; border-radius: 8px; text-decoration: none; transition: color .2s ease, background .2s ease;
}
.sl-nav-trigger:hover { color: #fff; background: rgba(255,255,255,0.06); }
.sl-nav-trigger svg { transition: transform .2s ease; }
.sl-nav-trigger svg.is-open { transform: rotate(180deg); }
.sl-nav-panel {
  position: absolute; top: calc(100% + 8px); left: 0; min-width: 220px;
  display: flex; flex-direction: column; padding: 8px;
  background: #0b0b0f; border: 1px solid var(--sl-border); border-radius: 14px;
  box-shadow: 0 24px 60px -20px rgba(0,0,0,0.8);
}
.sl-nav-panel-link { color: rgba(255,255,255,0.85); text-decoration: none; font-size: 0.92rem; padding: 10px 12px; border-radius: 9px; transition: background .18s ease, color .18s ease; }
.sl-nav-panel-link:hover { background: rgba(255,255,255,0.07); color: #fff; }
.sl-nav-cta { display: flex; align-items: center; gap: 10px; }
.sl-nav-burger { display: none; background: none; border: none; color: #fff; cursor: pointer; }
.sl-nav-mobile {
  position: fixed; inset: 0; z-index: 200; background: #000;
  display: flex; flex-direction: column; gap: 6px; padding: 88px 28px 28px;
}
.sl-nav-mobile a { color: #fff; text-decoration: none; font-family: var(--sl-display); text-transform: uppercase; font-size: 1.6rem; padding: 12px 0; border-bottom: 1px solid var(--sl-border); }
.sl-nav-mobile .sl-btn { margin-top: 18px; justify-content: center; }
.sl-nav-mobile-close { position: absolute; top: 24px; right: 24px; background: none; border: none; color: #fff; cursor: pointer; }

.sl-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 15px; border-radius: 999px; border: 1px solid var(--sl-border);
  font-size: 13px; font-weight: 600; color: var(--sl-muted); letter-spacing: .02em;
}

.sl-h2 { font-family: var(--sl-display); font-weight: 400; text-transform: uppercase; line-height: 0.92; letter-spacing: -0.01em; font-size: clamp(2.2rem,3.6vw,3.4rem); }
.sl-h2 br { display: none; }
.sl-h2 span br { display: block; }
.sl-h2-sm { font-size: clamp(1.8rem,3vw,2.6rem); }

/* ---------- hero (pinned scroll) ---------- */
.sl-hero-scroll { position: relative; height: 340vh; }
.sl-hero-scroll.sl-hero-static { height: auto; }
.sl-hero-pin { position: sticky; top: 0; height: 100vh; overflow: hidden; background: #000; }
.sl-hero-static .sl-hero-pin { position: relative; }
.sl-hero-stage { position: absolute; inset: 0; }
.sl-scene { position: absolute; inset: 0; perspective: 720px; perspective-origin: 50% 45%; }
.sl-media-layer { position: absolute; inset: 0; transform-style: preserve-3d; }
.sl-emerge-tile {
  position: absolute; left: 50%; top: 50%;
  width: clamp(150px, 17vw, 280px); aspect-ratio: 3/4;
  border-radius: 16px; overflow: hidden; border: 1px solid var(--sl-border);
  box-shadow: 0 30px 70px -25px rgba(0,0,0,0.85); will-change: transform, opacity;
}
.sl-emerge-tile img, .sl-emerge-tile video { width: 100%; height: 100%; object-fit: cover; }
.sl-copy-wrap {
  position: absolute; inset: 0; z-index: 20;
  display: flex; align-items: center; justify-content: center; pointer-events: none;
}
.sl-hero-copy { position: relative; text-align: center; padding: 0 20px; pointer-events: none; }
.sl-hero-copy::before {
  content: ""; position: absolute; inset: -45% -34%; z-index: -1; pointer-events: none;
  /* Wide, short ellipse biased to the headline band so the upper "ARIAMINDX AI"
     on the back wall stays readable while the copy is fully protected. */
  background: radial-gradient(ellipse 62% 58% at 50% 60%, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.9) 42%, rgba(0,0,0,0.55) 64%, rgba(0,0,0,0) 80%);
}
.sl-hero-copy .sl-btn, .sl-hero-copy a { pointer-events: auto; }
.sl-hero-title {
  font-family: var(--sl-display); font-weight: 400; text-transform: uppercase;
  font-size: clamp(1.9rem,3.9vw,3.4rem); line-height: 1.0; letter-spacing: -0.01em;
  margin: 18px 0 28px; text-shadow: 0 4px 40px rgba(0,0,0,0.9);
}
.sl-hero-actions { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
.sl-scroll-hint { position: absolute; bottom: 22px; left: 50%; transform: translateX(-50%); z-index: 20; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: var(--sl-muted); animation: sl-bob 2.2s ease-in-out infinite; }

/* 3D word room (phase A) — camera looks INTO a rectangular room. Each wall is
   translated out by half-width/height/depth then rotated 90deg, so the giant
   purple words tile the interior and converge to a central vanishing point. */
.sl-box {
  position: absolute; inset: 0; transform-style: preserve-3d; will-change: transform;
  --w: 54vw;  /* half room width  */
  --h: 54vh;  /* half room height */
  --d: 52vw;  /* room depth       */
}
/* Each wall is fully packed with big repeated words (via the inner span) and
   clips the bleed, so the purple tiles the interior with no black gaps. */
.sl-face {
  position: absolute; left: 50%; top: 50%;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  font-family: var(--sl-display); text-transform: uppercase; color: var(--sl-purple);
  letter-spacing: -0.02em; line-height: 0.82; backface-visibility: hidden; will-change: transform;
}
/* Rows of non-wrapping text keep the walls in clean parallel lines (no zig-zag). */
.sl-rows { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.06em; width: 100%; height: 100%; }
.sl-rows span { display: block; white-space: nowrap; }
/* Back wall wordmark: spread letters edge-to-edge across the whole row. */
.sl-back-word { display: flex; width: 100%; justify-content: space-between; white-space: nowrap; line-height: 0.9; }
.sl-back-word b { font-weight: inherit; font-style: normal; }
.sl-face-back {
  width: calc(var(--w) * 2); height: calc(var(--h) * 2); font-size: 13vw;
  align-items: flex-start; justify-content: center; padding: 4% 3% 0; color: #6d55e6;
  transform: translate(-50%, -50%) translateZ(calc(var(--d) * -1));
}
.sl-face-left {
  width: var(--d); height: calc(var(--h) * 2); font-size: 21vmin;
  transform: translate(-50%, -50%) translateX(calc(var(--w) * -1)) translateZ(calc(var(--d) * -0.5)) rotateY(90deg);
}
.sl-face-right {
  width: var(--d); height: calc(var(--h) * 2); font-size: 21vmin;
  transform: translate(-50%, -50%) translateX(var(--w)) translateZ(calc(var(--d) * -0.5)) rotateY(-90deg);
}
.sl-face-ceil {
  width: calc(var(--w) * 2); height: var(--d); font-size: 17vmin; color: #5a45cf;
  transform: translate(-50%, -50%) translateY(calc(var(--h) * -1)) translateZ(calc(var(--d) * -0.5)) rotateX(-90deg);
}
.sl-face-floor {
  width: calc(var(--w) * 2); height: var(--d); font-size: 17vmin;
  transform: translate(-50%, -50%) translateY(var(--h)) translateZ(calc(var(--d) * -0.5)) rotateX(90deg);
}
@media (max-width: 760px) {
  .sl-box { --w: 66vw; --h: 66vh; --d: 74vw; }
  .sl-scene { perspective: 500px; }
  .sl-hero-scroll { height: 300vh; }
  /* Drop the tile count to ~8 on small screens to keep the fly-in at 60fps. */
  .sl-emerge-tile:nth-child(n + 9) { display: none; }
}

/* gallery cloud (phase B) */
.sl-gallery-cloud { position: absolute; inset: 0; }
.sl-cloud-tile {
  position: absolute; transform: translate(-50%,-50%); width: 15vw; min-width: 130px; max-width: 260px;
  aspect-ratio: 3/4; border-radius: 14px; overflow: hidden; border: 1px solid var(--sl-border);
  box-shadow: 0 30px 70px -25px rgba(0,0,0,0.9);
}
.sl-cloud-tile img { width: 100%; height: 100%; object-fit: cover; }

/* ---------- stats marquee ---------- */
.sl-marquee-wrap { padding: clamp(50px,9vw,120px) 0; overflow: hidden; }
.sl-marquee-persp { perspective: 1300px; }
.sl-marquee-track {
  display: flex; align-items: center; gap: 7vw; width: max-content;
  cursor: grab; transform: rotateX(9deg) rotateY(-7deg); transform-origin: center;
}
.sl-marquee-track:active { cursor: grabbing; }
.sl-stat { display: flex; flex-direction: column; align-items: flex-start; user-select: none; }
.sl-stat-value { font-family: var(--sl-display); font-size: clamp(6rem,17vw,15rem); line-height: 0.82; letter-spacing: -0.02em; }
.sl-stat-label { font-family: var(--sl-display); text-transform: uppercase; font-size: clamp(1rem,2vw,2rem); letter-spacing: 0; margin-top: 4px; white-space: nowrap; }

/* ---------- features ---------- */
.sl-features { display: flex; flex-direction: column; gap: clamp(60px,9vw,130px); padding: clamp(40px,7vw,90px) clamp(20px,5vw,64px); max-width: 1440px; margin: 0 auto; }
.sl-feature { display: grid; grid-template-columns: 1fr 1fr; gap: clamp(28px,5vw,72px); align-items: center; }
.sl-feature.media-left .sl-feature-copy { order: 2; }
.sl-feature.media-left .sl-feature-visual { order: 1; }
.sl-feature-body { color: var(--sl-muted); font-size: 1.1rem; line-height: 1.65; margin: 20px 0 28px; max-width: 460px; }
.sl-feature-actions { display: flex; gap: 12px; flex-wrap: wrap; }

.sl-media-frame { position: relative; aspect-ratio: 4/3; border-radius: 22px; overflow: hidden; border: 1px solid var(--sl-border); box-shadow: 0 40px 90px -40px rgba(0,0,0,0.9); }
.sl-media-img { width: 100%; height: 100%; object-fit: cover; }
.sl-media-overlay { position: absolute; top: -2px; left: 18px; font-family: var(--sl-display); text-transform: uppercase; font-size: clamp(2rem,4vw,3.4rem); color: var(--sl-purple); text-shadow: 0 2px 20px rgba(0,0,0,0.6); }
.sl-prompt-bar { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); width: min(88%, 460px); padding: 12px 16px; border-radius: 12px; background: rgba(0,0,0,0.62); border: 1px solid var(--sl-border); backdrop-filter: blur(8px); font-size: 14px; }
.sl-typewriter { color: #fff; }
.sl-caret { display: inline-block; width: 2px; height: 1em; background: #fff; margin-left: 2px; vertical-align: text-bottom; animation: sl-blink 1s steps(1) infinite; }
.sl-media-chips { position: absolute; left: 14px; bottom: 14px; display: flex; gap: 8px; flex-wrap: wrap; }
.sl-media-ctrl { position: absolute; right: 14px; bottom: 14px; display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 999px; background: rgba(0,0,0,0.6); border: 1px solid var(--sl-border); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; backdrop-filter: blur(6px); }
.sl-chip { background: var(--sl-green); color: #000; border-radius: 7px; padding: 4px 10px; font-size: 12px; font-weight: 700; }
.sl-chip-onimg { position: absolute; left: 12px; bottom: 12px; }

/* ---------- prompt gallery ---------- */
.sl-pgallery { padding: clamp(50px,8vw,110px) clamp(20px,5vw,64px); max-width: 1440px; margin: 0 auto; }
.sl-pgrid { display: grid; grid-template-columns: repeat(3,1fr); gap: 24px; }
.sl-pcard { margin: 0; }
.sl-pcard-media { position: relative; border-radius: 16px; overflow: hidden; border: 1px solid var(--sl-border); aspect-ratio: 4/5; }
.sl-pcard-media img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
.sl-pcard:hover .sl-pcard-media img { transform: scale(1.05); }
.sl-pcard-caption { color: var(--sl-muted); font-size: 0.9rem; line-height: 1.5; margin-top: 12px; }

/* ---------- tutorials ---------- */
.sl-tutorials { padding: clamp(40px,7vw,90px) 0 clamp(50px,8vw,110px); }
.sl-tut-head { display: flex; align-items: baseline; justify-content: space-between; padding: 0 clamp(20px,5vw,64px); max-width: 1440px; margin: 0 auto 28px; }
.sl-viewall { color: var(--sl-muted); text-decoration: none; font-size: 14px; display: inline-flex; align-items: center; gap: 4px; }
.sl-viewall:hover { color: #fff; }
.sl-tut-rail-wrap { position: relative; }
.sl-tut-rail { display: flex; gap: 22px; overflow-x: auto; scroll-snap-type: x mandatory; padding: 4px clamp(20px,5vw,64px); scrollbar-width: none; }
.sl-tut-rail::-webkit-scrollbar { display: none; }
.sl-tut-card { flex: 0 0 340px; scroll-snap-align: start; border-radius: 18px; overflow: hidden; border: 1px solid var(--sl-border); }
.sl-tut-media { aspect-ratio: 16/10; }
.sl-tut-media img { width: 100%; height: 100%; object-fit: cover; }
.sl-tut-block { font-family: var(--sl-display); text-transform: uppercase; color: #000; padding: 20px 22px; font-size: 1.35rem; line-height: 1; min-height: 96px; display: flex; align-items: center; }
.sl-tut-next { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); width: 48px; height: 48px; border-radius: 50%; background: #fff; color: #000; border: none; display: grid; place-items: center; cursor: pointer; box-shadow: 0 10px 30px -8px rgba(0,0,0,0.6); }

/* ---------- artist stories ---------- */
.sl-artists { padding: clamp(50px,8vw,110px) clamp(20px,5vw,64px); max-width: 1440px; margin: 0 auto; }
.sl-mega { font-family: var(--sl-display); text-transform: uppercase; font-size: clamp(2.6rem,8vw,7rem); line-height: 0.9; letter-spacing: -0.02em; display: flex; align-items: center; gap: 0.05em; margin-bottom: 42px; }
.sl-mega-star { color: var(--sl-purple); flex: 0 0 auto; }
.sl-artist-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 20px; }
.sl-artist-card { position: relative; border-radius: 16px; overflow: hidden; aspect-ratio: 3/4; border: 1px solid var(--sl-border); }
.sl-artist-card img { width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; }
.sl-artist-card:hover img { transform: scale(1.06); }
.sl-artist-meta { position: absolute; left: 0; right: 0; bottom: 0; padding: 40px 16px 16px; background: linear-gradient(transparent, rgba(0,0,0,0.85)); display: flex; flex-direction: column; }
.sl-artist-name { font-family: var(--sl-display); text-transform: uppercase; font-size: 1.3rem; line-height: 1; }
.sl-artist-role { color: var(--sl-muted); font-size: 0.85rem; margin-top: 4px; }

/* ---------- scale ---------- */
.sl-scale { padding: clamp(60px,9vw,130px) clamp(20px,5vw,64px); max-width: 1200px; margin: 0 auto; text-align: center; }
.sl-scale-heading { font-family: var(--sl-display); text-transform: uppercase; color: var(--sl-green); font-size: clamp(2.4rem,7vw,6rem); line-height: 0.92; letter-spacing: -0.02em; }
.sl-scale-sub { color: var(--sl-muted); font-size: 1.1rem; line-height: 1.6; max-width: 640px; margin: 22px auto 48px; }
.sl-logo-wall { display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; }
.sl-logo-tile { display: grid; place-items: center; height: 120px; border-radius: 16px; background: #0a0a0a; border: 1px solid var(--sl-border); transition: border-color .2s ease; }
.sl-logo-tile:hover { border-color: rgba(255,255,255,0.35); }
.sl-logo-tile img { max-height: 48px; max-width: 60%; object-fit: contain; filter: grayscale(1) brightness(1.6); opacity: 0.75; transition: filter .3s ease, opacity .3s ease; }
.sl-logo-tile:hover img { filter: none; opacity: 1; }

/* ---------- footer ---------- */
.sl-footer { border-top: 1px solid var(--sl-border); padding-top: 60px; }
.sl-footer-cols { display: grid; grid-template-columns: repeat(5,1fr); gap: 24px; max-width: 1440px; margin: 0 auto; padding: 0 clamp(20px,5vw,64px) 50px; }
.sl-footer-col h4 { font-size: 0.8rem; text-transform: uppercase; letter-spacing: .08em; color: var(--sl-muted); margin: 0 0 14px; }
.sl-footer-link { display: block; color: #fff; text-decoration: none; font-size: 0.95rem; padding: 6px 0; opacity: 0.85; }
.sl-footer-link:hover { opacity: 1; color: var(--sl-purple); }
.sl-cta-band { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; max-width: 1440px; margin: 0 auto; padding: 34px clamp(20px,5vw,64px); border-top: 1px solid var(--sl-border); font-family: var(--sl-display); text-transform: uppercase; font-size: clamp(1.2rem,2.4vw,2rem); }
.sl-wordmark { font-family: var(--sl-display); text-transform: uppercase; color: var(--sl-purple); font-size: clamp(3.4rem,15.5vw,13rem); line-height: 0.8; text-align: center; letter-spacing: -0.02em; padding: 10px 12px 0; white-space: nowrap; overflow: hidden; }
.sl-footer-bar { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 10px; padding: 24px clamp(20px,5vw,64px) 34px; color: var(--sl-muted); font-size: 13px; }

/* ---------- keyframes ---------- */
@keyframes sl-blink { 50% { opacity: 0; } }
@keyframes sl-bob { 0%,100% { transform: translate(-50%,0); } 50% { transform: translate(-50%,7px); } }

/* anchor targets clear the fixed navbar */
.sl-root section[id] { scroll-margin-top: 84px; }

/* ---------- responsive ---------- */
@media (max-width: 960px) {
  .sl-nav-links { display: none; }
  .sl-nav-burger { display: inline-flex; }
  .sl-nav-cta .sl-btn { display: none; }
}
@media (max-width: 1000px) {
  .sl-pgrid { grid-template-columns: repeat(2,1fr); }
  .sl-artist-row { grid-template-columns: repeat(2,1fr); }
  .sl-footer-cols { grid-template-columns: repeat(3,1fr); }
}
@media (max-width: 760px) {
  .sl-feature { grid-template-columns: 1fr; }
  .sl-feature.media-left .sl-feature-copy, .sl-feature.media-left .sl-feature-visual { order: initial; }
  .sl-pgrid { grid-template-columns: 1fr; }
  .sl-artist-row { grid-template-columns: 1fr 1fr; }
  .sl-footer-cols { grid-template-columns: 1fr 1fr; }
  .sl-logo-wall { grid-template-columns: 1fr 1fr; }
  .sl-tut-card { flex-basis: 260px; }
}
@media (prefers-reduced-motion: reduce) {
  .sl-scroll-hint, .sl-caret { animation: none; }
}
`;
