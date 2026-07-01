# Build Spec — Leonardo.ai-Style Landing Page

> **Purpose:** A complete, code-level specification Claude Code can follow to build a landing page that looks and *moves* like [leonardo.ai](https://leonardo.ai) — dark cinematic theme, generative-art galleries, image→video motion, 3D text rotation, and scroll-driven reveals.
>
> **Target stack (matches this repo):** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Framer Motion 12 · lucide-react.
>
> **Note on source:** leonardo.ai blocks automated fetching, so this spec reproduces its *design language and interaction patterns* rather than copying markup. Treat it as the source of truth. Do not invent extra sections; build exactly what is listed here.

---

## 0. Golden Rules (read first)

1. **Every animated component is a Client Component.** Add `"use client"` at the top of any file that imports `framer-motion` or uses `useState`/`useEffect`/hooks. Page shells and static content stay Server Components.
2. **Respect `prefers-reduced-motion`.** Wrap all decorative motion so it becomes static when the user opts out. Use Framer's `useReducedMotion()` and gate infinite loops.
3. **Never animate `width`/`height`/`top`/`left`.** Animate only `transform` (`x`, `y`, `scale`, `rotate`) and `opacity`. This is what keeps it at 60fps.
4. **Lazy-load heavy media.** Video and below-the-fold galleries load on scroll, not on mount.
5. **Build section by section in the order below.** Each section is self-contained; ship it, verify motion, then move on.
6. **Mobile first, but motion last.** Layout must work at 375px wide; reduce/disable parallax and 3D on small screens.

---

## 1. Design System

### 1.1 Color tokens

Leonardo's palette is near-black with a violet→magenta→cyan accent gradient and glassy surfaces. Define these as CSS variables in `app/globals.css` (this repo already uses `var(--*)` tokens — extend that pattern):

```css
:root {
  /* Backgrounds — deep space black, not pure #000 */
  --ld-bg:            #08080B;   /* page base */
  --ld-bg-elevated:   #101014;   /* cards / panels */
  --ld-bg-glass:      rgba(20, 20, 28, 0.55); /* frosted nav/cards */

  /* Text */
  --ld-text:          #F5F5F7;
  --ld-text-muted:    #A1A1AA;
  --ld-text-dim:      #6B6B76;

  /* Accent gradient stops */
  --ld-violet:        #7C3AED;
  --ld-magenta:       #D946EF;
  --ld-cyan:          #22D3EE;
  --ld-blue:          #4F46E5;

  /* Composite gradients */
  --ld-grad-brand:  linear-gradient(100deg, #7C3AED 0%, #D946EF 45%, #22D3EE 100%);
  --ld-grad-text:   linear-gradient(92deg, #C4B5FD 0%, #F0ABFC 50%, #A5F3FC 100%);
  --ld-grad-radial: radial-gradient(120% 120% at 50% 0%, rgba(124,58,237,0.35) 0%, rgba(8,8,11,0) 60%);

  --ld-border:        rgba(255,255,255,0.08);
  --ld-border-hover:  rgba(255,255,255,0.16);

  --ld-radius:        16px;
  --ld-radius-lg:     24px;
  --ld-shadow-glow:   0 0 40px -8px rgba(124,58,237,0.5);
}
```

### 1.2 Tailwind extension

Add to `tailwind.config.ts` under `theme.extend` (keep existing tokens):

```ts
colors: {
  ld: {
    bg: "var(--ld-bg)",
    elevated: "var(--ld-bg-elevated)",
    text: "var(--ld-text)",
    muted: "var(--ld-text-muted)",
    violet: "var(--ld-violet)",
    magenta: "var(--ld-magenta)",
    cyan: "var(--ld-cyan)",
    border: "var(--ld-border)",
  },
},
backgroundImage: {
  "ld-brand": "var(--ld-grad-brand)",
  "ld-text": "var(--ld-grad-text)",
  "ld-radial": "var(--ld-grad-radial)",
},
keyframes: {
  marquee:        { from: { transform: "translateX(0)" },   to: { transform: "translateX(-50%)" } },
  "marquee-vert": { from: { transform: "translateY(0)" },   to: { transform: "translateY(-50%)" } },
  shimmer:        { "100%": { transform: "translateX(100%)" } },
  float:          { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-12px)" } },
  "gradient-pan": { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
},
animation: {
  marquee:        "marquee 40s linear infinite",
  "marquee-slow": "marquee 70s linear infinite",
  "marquee-vert": "marquee-vert 30s linear infinite",
  float:          "float 6s ease-in-out infinite",
  "gradient-pan": "gradient-pan 8s ease infinite",
},
```

### 1.3 Typography

- **Display font:** a tight geometric sans (Leonardo uses a custom face; use `Geist` — already configured here — or `Inter Tight`/`Satoshi` if added). Headings are **bold, tight tracking, large**.
- **Scale (clamp for fluid sizing):**
  - Hero H1: `clamp(2.75rem, 6vw, 5.5rem)`, `font-weight: 700`, `letter-spacing: -0.03em`, `line-height: 1.02`.
  - Section H2: `clamp(2rem, 4vw, 3.25rem)`, `-0.02em`.
  - Body/subhead: `clamp(1rem, 1.4vw, 1.25rem)`, `--ld-text-muted`.
- **Gradient headline utility:**

```css
.text-gradient {
  background: var(--ld-grad-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

### 1.4 Layout primitives

- Max content width `1200px`, centered, `px-6 md:px-8`.
- Section vertical rhythm: `py-24 md:py-36`.
- Glass card: `bg-[var(--ld-bg-glass)] backdrop-blur-xl border border-[var(--ld-border)] rounded-[var(--ld-radius-lg)]`.

---

## 2. Animation Foundation

Install nothing new — `framer-motion@^12` is already in `package.json`.

### 2.1 Shared motion utilities — `components/landing/motion.ts`

```ts
"use client";
import { Variants } from "framer-motion";

// Standard easing used everywhere (Leonardo's motion is smooth, slightly overshooting)
export const EASE = [0.22, 1, 0.36, 1] as const; // easeOutExpo-ish

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.6, ease: EASE } },
};

export const blurIn: Variants = {
  hidden: { opacity: 0, filter: "blur(12px)", y: 20 },
  show:   { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.8, ease: EASE } },
};
```

### 2.2 Reveal-on-scroll wrapper — `components/landing/Reveal.tsx`

The workhorse: fades + rises children as they enter the viewport, once.

```tsx
"use client";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { fadeUp } from "./motion";

export function Reveal({
  children,
  variants = fadeUp,
  className,
  amount = 0.3,
  delay = 0,
}: {
  children: React.ReactNode;
  variants?: Variants;
  className?: string;
  amount?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
```

### 2.3 The four signature effects (implementation contracts)

| Effect | Where | Technique |
|---|---|---|
| **Scroll reveal** | every section | `<Reveal>` / `whileInView` |
| **Parallax** | hero art, feature imagery | `useScroll` + `useTransform` on `y` |
| **Infinite marquee** | logo strip, image galleries | duplicated track + CSS `animation: marquee` |
| **3D text rotation** | hero word-rotator + section headings | `rotateX` on `transform-style: preserve-3d` with `perspective` |

---

## 3. Section-by-Section Build

Page assembly (`app/page.tsx` or wherever the marketing route lives — this repo has `components/LandingPage.tsx`; build a new `components/landing/` set and compose them):

```
<Nav />                 §3.1
<Hero />                §3.2
<LogoMarquee />         §3.3
<GalleryMarquee />      §3.4  (the signature moving image walls)
<FeatureImageToImage /> §3.5
<FeatureImageToVideo /> §3.6  (autoplay muted video)
<ToolsGrid />           §3.7
<StatsBand />           §3.8
<Testimonials />        §3.9
<PricingTeaser />       §3.10
<FinalCTA />            §3.11
<Footer />              §3.12
```

---

### 3.1 Navigation — floating glass bar

**Content:** left = logo. center = links: `Solutions ▾`, `Features`, `Pricing`, `API`, `Learn ▾`. right = `Log in` (ghost) + `Get Started` (gradient pill).

**Behavior:**
- Fixed to top, full-width, transparent at scroll `y=0`.
- On scroll past ~40px: background becomes `var(--ld-bg-glass)` + `backdrop-blur-xl` + bottom border fades in. Animate via `useScroll`.
- Dropdowns (`Solutions`, `Learn`) open a glass mega-panel on hover (desktop) / tap (mobile) with `AnimatePresence` scale+fade.
- Mobile: hamburger → full-screen overlay menu sliding in from right (`x: "100%" → 0`).

```tsx
"use client";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";

export function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 40));
  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 transition-colors duration-300"
      animate={{
        backgroundColor: solid ? "rgba(16,16,20,0.7)" : "rgba(16,16,20,0)",
        backdropFilter: solid ? "blur(16px)" : "blur(0px)",
        borderColor: solid ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0)",
      }}
      style={{ borderBottomWidth: 1 }}
    >
      {/* logo · links · CTAs — see content above */}
    </motion.header>
  );
}
```

---

### 3.2 Hero — the centerpiece

**Content:**
- Small eyebrow pill: "✦ Now with AI Video" (subtle border, glass).
- **H1** with a **rotating word**: `Create stunning [ art / images / video / worlds ]` — the bracketed word cycles with a 3D flip.
- Subhead: one sentence, `--ld-text-muted`, max-width ~560px.
- Two CTAs: `Get Started — Free` (gradient pill, glow on hover) + `Watch demo ▷` (ghost, opens video modal).
- Below: floating hero artwork / a soft parallax collage of generated images, plus the radial glow (`--ld-grad-radial`) behind the headline.

**Animations:**
1. **Entrance:** container `stagger`; eyebrow → H1 → subhead → CTAs each `blurIn` in sequence.
2. **3D word rotator** (signature): the changing word flips on the X-axis every 2.2s.
3. **Background parallax:** hero art moves slower than scroll (`y` transform on `useScroll`).
4. **Ambient float:** decorative art tiles use `animation-float` at staggered delays.
5. **Radial aurora:** the glow slowly pans (`animate-gradient-pan`).

**3D word rotator — `components/landing/WordRotator.tsx`:**

```tsx
"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const WORDS = ["art", "images", "video", "worlds"];

export function WordRotator() {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setI((v) => (v + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, [reduce]);

  return (
    <span
      className="relative inline-block align-baseline"
      style={{ perspective: 600 }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={WORDS[i]}
          className="inline-block text-gradient"
          style={{ transformStyle: "preserve-3d", transformOrigin: "50% 100%" }}
          initial={{ rotateX: -90, opacity: 0, y: 8 }}
          animate={{ rotateX: 0, opacity: 1, y: 0 }}
          exit={{ rotateX: 90, opacity: 0, y: -8 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          {WORDS[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
```

**Parallax hero art — pattern:**

```tsx
"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -120]);   // moves up slower
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  return (
    <div ref={ref} className="relative">
      <motion.div style={{ y, scale }}>{/* collage / hero image */}</motion.div>
    </div>
  );
}
```

**CTA button with hover glow:**

```tsx
<motion.a
  href="/signup"
  className="relative rounded-full px-7 py-3.5 font-semibold text-white bg-ld-brand"
  whileHover={{ scale: 1.04 }}
  whileTap={{ scale: 0.97 }}
  style={{ boxShadow: "var(--ld-shadow-glow)" }}
>
  Get Started — Free
</motion.a>
```

---

### 3.3 Logo marquee — "trusted by"

Infinite horizontal scroll of client/press logos, greyscale → color on hover, edges masked to fade.

```tsx
export function LogoMarquee({ logos }: { logos: string[] }) {
  const track = [...logos, ...logos]; // duplicate for seamless loop
  return (
    <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
      <div className="flex w-max gap-16 animate-marquee hover:[animation-play-state:paused]">
        {track.map((src, i) => (
          <img key={i} src={src} alt="" className="h-7 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition" />
        ))}
      </div>
    </div>
  );
}
```

> **Seamless-loop rule:** the CSS keyframe moves the track `-50%`, so the content **must** be duplicated exactly once. Any other amount will jump.

---

### 3.4 Gallery marquees — the signature moving image walls

Leonardo's most recognizable feature: **multiple rows/columns of AI images drifting continuously in alternating directions.** Use 2–3 rows scrolling opposite ways, or vertical columns in the hero flank.

```tsx
export function GalleryMarquee({ rows }: { rows: string[][] }) {
  return (
    <section className="space-y-6 overflow-hidden py-12">
      {rows.map((imgs, r) => {
        const track = [...imgs, ...imgs];
        const dir = r % 2 === 0 ? "animate-marquee" : "animate-marquee-slow";
        const reverse = r % 2 === 1 ? "[animation-direction:reverse]" : "";
        return (
          <div key={r} className="relative overflow-hidden">
            <div className={`flex w-max gap-5 ${dir} ${reverse}`}>
              {track.map((src, i) => (
                <div key={i} className="relative h-56 w-40 shrink-0 overflow-hidden rounded-2xl border border-ld-border">
                  <img src={src} alt="" className="h-full w-full object-cover transition duration-500 hover:scale-110" loading="lazy" />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
```

- Rows alternate direction (`reverse`) and speed for depth.
- On hover of an individual tile: `scale-110` zoom + subtle brightness lift; optionally pause the whole row (`hover:[animation-play-state:paused]`).
- Vertical variant: swap to `animate-marquee-vert` inside a fixed-height column with `flex-col`.

---

### 3.5 Feature — Image-to-Image (scroll-pinned reveal)

**Content:** H2 "From a single image to infinite variations", short paragraph, feature bullets, and a **before→after** visual.

**Signature interaction — reveal slider or crossfade tied to scroll:**
- As the section scrolls into center, a clip-path / opacity crossfade morphs the "before" image into the "after" render.
- Text column reveals with `stagger` bullets; image column `scaleIn`.

```tsx
"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function BeforeAfter({ before, after }: { before: string; after: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "start 30%"] });
  const clip = useTransform(scrollYProgress, [0, 1], ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);
  return (
    <div ref={ref} className="relative aspect-[4/3] overflow-hidden rounded-3xl">
      <img src={before} className="absolute inset-0 h-full w-full object-cover" alt="" />
      <motion.img src={after} style={{ clipPath: clip }} className="absolute inset-0 h-full w-full object-cover" alt="" />
    </div>
  );
}
```

---

### 3.6 Feature — Image-to-Video (autoplay motion)

**Content:** H2 "Bring your images to life", paragraph, and a looping **muted autoplay video** showing a still animating into motion.

**Rules:**
- `<video autoPlay muted loop playsInline preload="none" poster="...">` — `muted`+`playsInline` are mandatory for iOS autoplay.
- Lazy-mount the video only when near viewport (IntersectionObserver) to save bandwidth; before that show the `poster` still.
- Wrap in a glass frame with a soft outer glow; add a faint gradient border that pans (`animate-gradient-pan`).
- On scroll-in, `scaleIn` the whole frame.

```tsx
"use client";
import { useEffect, useRef, useState } from "react";

export function AutoVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShow(true), { rootMargin: "200px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative overflow-hidden rounded-3xl border border-ld-border" style={{ boxShadow: "var(--ld-shadow-glow)" }}>
      {show
        ? <video src={src} poster={poster} autoPlay muted loop playsInline preload="none" className="h-full w-full object-cover" />
        : <img src={poster} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}
```

---

### 3.7 Tools grid — feature cards

**Content:** 6–8 cards (Image Generation, Motion/Video, Canvas Editor, Upscaler, Real-time Canvas, 3D Textures, API, Universal Upscaler). Each card: icon (lucide-react), title, one-line description, thumbnail.

**Animation:**
- Grid reveals with `stagger` + `fadeUp`, each card delayed by index.
- **Card hover (3D tilt):** card rotates toward cursor using `rotateX`/`rotateY` from pointer position; add a moving spotlight highlight.

```tsx
"use client";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

export function TiltCard({ children }: { children: React.ReactNode }) {
  const mx = useMotionValue(0.5), my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [8, -8]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-8, 8]), { stiffness: 200, damping: 20 });
  return (
    <motion.div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", perspective: 800 }}
      className="rounded-3xl border border-ld-border bg-ld-elevated p-6"
    >
      {children}
    </motion.div>
  );
}
```

---

### 3.8 Stats band — animated counters

**Content:** e.g. `19B+ images generated`, `35M+ users`, `150+ countries`, `4.9★ rating`.

**Animation:** numbers count up from 0 when the band scrolls into view.

```tsx
"use client";
import { animate, useInView, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const mv = useMotionValue(0);
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(mv, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setVal(Math.round(v)) });
    return () => c.stop();
  }, [inView, to, mv]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}
```

---

### 3.9 Testimonials

**Content:** 3-up quote cards (avatar, name, role, quote) — or an auto-scrolling marquee of many. Optionally a rating badge.

**Animation:** `stagger` reveal for the 3-up; or reuse the marquee for a continuous ribbon that pauses on hover.

---

### 3.10 Pricing teaser

**Content:** 3–4 tiers (Free, Apprentice, Artisan, Maestro / or your equivalents). Highlighted "most popular" middle tier with gradient border. Monthly/annual toggle.

**Animation:**
- Cards `fadeUp` staggered.
- Toggle animates prices with a quick number crossfade.
- Popular card has a **animated gradient border** (`animate-gradient-pan` on a wrapping pseudo-element) and slight lift on hover.

---

### 3.11 Final CTA

**Content:** big centered gradient headline "Start creating today", one CTA pill, ambient aurora background.

**Animation:** headline `blurIn`; background aurora blobs drift (`animate-float` at different delays); CTA pulses gently (`scale` loop with reduced-motion guard).

---

### 3.12 Footer

**Content:** multi-column link grid (Product, Solutions, Resources, Company, Legal), logo, newsletter input, social icons, copyright. Dark, bordered top.

**Animation:** subtle `fadeUp` on scroll-in; social icons `scale` on hover. Keep it calm — footers don't need heavy motion.

---

## 4. Global background layer (optional but on-brand)

Leonardo has faint moving ambience behind the whole page. This repo already has `NeuralBackground.tsx` / `StarSky.tsx` / `HeroBackdrop.tsx` — reuse one, OR add fixed aurora blobs:

```tsx
// components/landing/Aurora.tsx  ("use client" not required if no hooks)
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-1/4 h-[40rem] w-[40rem] rounded-full bg-ld-violet/20 blur-[120px] animate-float" />
      <div className="absolute top-1/3 right-1/4 h-[32rem] w-[32rem] rounded-full bg-ld-magenta/15 blur-[120px] animate-float [animation-delay:2s]" />
      <div className="absolute bottom-0 left-1/3 h-[36rem] w-[36rem] rounded-full bg-ld-cyan/10 blur-[120px] animate-float [animation-delay:4s]" />
    </div>
  );
}
```

Set `<body>` background to `--ld-bg` and mount `<Aurora />` once in the layout.

---

## 5. Assets

You cannot hotlink Leonardo's media. Source or generate replacements:

| Asset | Count | Spec | Where used |
|---|---|---|---|
| Gallery images | 24–40 | 3:4 portrait, ~640×854, WebP/AVIF, <120KB each | §3.4 marquees, §3.2 hero collage |
| Before/after pair | 1–2 | matched 4:3 | §3.5 |
| Demo video | 1–2 | MP4 (H.264) + WebM, muted loop, ≤8s, ≤2MB, 720p, with poster JPG | §3.6, hero demo modal |
| Client logos | 8–14 | SVG or transparent PNG, monochrome | §3.3 |
| Avatars | 3–8 | square 96×96 | §3.9 |

Put them in `public/landing/`. Use Next `<Image>` for static gallery images (better LCP); use plain `<img loading="lazy">` inside marquees where fill layout is awkward. Convert to AVIF/WebP.

---

## 6. Performance & accessibility checklist

- [ ] Only `transform`/`opacity`/`filter` animated (no layout props).
- [ ] `useReducedMotion()` gates every infinite loop, parallax, tilt, and counter; page is fully usable static.
- [ ] Marquees pause on hover and stop when off-screen (`content-visibility: auto` on rows helps).
- [ ] Hero image is `priority` for LCP; everything else lazy.
- [ ] Video: `muted playsInline preload="none" poster`, IntersectionObserver-mounted.
- [ ] All decorative elements `aria-hidden`; all real images have `alt`; all interactive elements are real `<a>`/`<button>` and keyboard-focusable with visible focus rings.
- [ ] Color contrast: body text `--ld-text-muted` on `--ld-bg` ≥ 4.5:1 (it passes; don't go dimmer for paragraphs).
- [ ] Test at 375px, 768px, 1440px. Disable 3D tilt and reduce parallax distance on `< md`.
- [ ] `next build` clean; no hydration warnings (guard `Date.now()`/random in render).

---

## 7. Build order for Claude Code

1. **Foundation:** add color tokens (§1.1) to `globals.css`, extend Tailwind (§1.2), add `motion.ts` + `Reveal.tsx` (§2).
2. **Shell:** page route + `<Aurora />` + dark body.
3. **Nav** (§3.1) → verify scroll-solidify + mobile menu.
4. **Hero** (§3.2) incl. `WordRotator` + `HeroArt` parallax → verify 3D flip + entrance stagger.
5. **Marquees** (§3.3, §3.4) → verify seamless loop (no jump) + hover pause.
6. **Feature sections** (§3.5 before/after, §3.6 autoplay video) → verify scroll clip + iOS autoplay.
7. **Tools grid** (§3.7) with `TiltCard`.
8. **Stats** (§3.8) counters → verify count-up triggers once in view.
9. **Testimonials, Pricing, Final CTA, Footer** (§3.9–3.12).
10. **Pass 2:** run the §6 checklist; add reduced-motion guards everywhere; Lighthouse ≥ 90 perf / 100 a11y.

Ship each numbered step working before starting the next. Do not batch — motion bugs are easiest to isolate one section at a time.
