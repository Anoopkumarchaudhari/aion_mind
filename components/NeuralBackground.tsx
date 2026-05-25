"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/store/useChatStore";

type NeuronNode = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  layer: number;
  phase: number;
};

type SynapsePulse = {
  from: number;
  to: number;
  t: number;
  speed: number;
};

type NeuralBackgroundProps = {
  intensity?: "normal" | "active";
};

const CONNECT_DIST = 170;

export function NeuralBackground({ intensity = "normal" }: NeuralBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tempMode = useChatStore((state) => state.tempMode);
  const tempRef = useRef(tempMode);
  tempRef.current = tempMode;

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const canvasElement: HTMLCanvasElement = canvas;
    const context: CanvasRenderingContext2D = ctx;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let nodes: NeuronNode[] = [];
    let pulses: SynapsePulse[] = [];
    let raf = 0;
    let running = false;
    let lastSpawn = 0;
    const mouse = { x: -9999, y: -9999 };
    const isActive = intensity === "active";
    const maxPulses = isActive ? 42 : 22;
    const pulseInterval = isActive ? 145 : 280;
    const motionMultiplier = isActive ? 1.65 : 1;
    const lineMultiplier = isActive ? 1.3 : 1;
    const nodeMultiplier = isActive ? 1.18 : 1;

    function density() {
      return Math.round((width * height) / (isActive ? 14500 : 22000));
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvasElement.clientWidth;
      height = canvasElement.clientHeight;
      canvasElement.width = Math.max(1, Math.floor(width * dpr));
      canvasElement.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      const count = Math.max(isActive ? 62 : 40, Math.min(density(), isActive ? 150 : 110));

      nodes = Array.from({ length: count }, () => {
        const layer = Math.random() < 0.5 ? 0 : Math.random() < 0.7 ? 1 : 2;
        const speedMultiplier = (layer === 2 ? 0.25 : layer === 1 ? 0.15 : 0.08) * motionMultiplier;

        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * speedMultiplier,
          vy: (Math.random() - 0.5) * speedMultiplier,
          r:
            layer === 2
              ? 2.2 + Math.random() * 2.5
              : layer === 1
                ? 1.4 + Math.random() * 1.2
                : 0.8 + Math.random() * 0.8,
          layer,
          phase: Math.random() * Math.PI * 2
        };
      });
      pulses = [];
    }

    function palette() {
      if (isActive) {
        return { node: "56,189,248", line: "45,160,230", pulse: "125,211,252", accent: "34,211,238" };
      }

      return tempRef.current
        ? { node: "244,114,182", line: "236,99,160", pulse: "253,224,71", accent: "251,113,133" }
        : { node: "56,189,248", line: "45,160,230", pulse: "236,72,153", accent: "34,211,238" };
    }

    function spawnPulse() {
      if (pulses.length >= maxPulses || nodes.length === 0) {
        return;
      }

      const from = Math.floor(Math.random() * nodes.length);
      const near: number[] = [];

      for (let index = 0; index < nodes.length; index += 1) {
        if (index === from) {
          continue;
        }

        const distance = Math.hypot(nodes[from].x - nodes[index].x, nodes[from].y - nodes[index].y);

        if (distance < CONNECT_DIST) {
          near.push(index);
        }
      }

      if (near.length === 0) {
        return;
      }

      pulses.push({
        from,
        to: near[Math.floor(Math.random() * near.length)],
        t: 0,
        speed: (0.006 + Math.random() * 0.008) * (isActive ? 1.28 : 1)
      });
    }

    function draw(now: number, animated: boolean) {
      context.clearRect(0, 0, width, height);
      const color = palette();

      for (const node of nodes) {
        if (animated) {
          node.x += node.vx;
          node.y += node.vy;
          node.phase += 0.015;

          if (node.layer === 2) {
            const dx = mouse.x - node.x;
            const dy = mouse.y - node.y;
            const distance = Math.hypot(dx, dy);

            if (distance < 180 && distance > 1) {
              node.x += (dx / distance) * 0.25;
              node.y += (dy / distance) * 0.25;
            }
          }
        }

        if (node.x < -20) {
          node.x = width + 20;
        }

        if (node.x > width + 20) {
          node.x = -20;
        }

        if (node.y < -20) {
          node.y = height + 20;
        }

        if (node.y > height + 20) {
          node.y = -20;
        }
      }

      for (let first = 0; first < nodes.length; first += 1) {
        for (let second = first + 1; second < nodes.length; second += 1) {
          const a = nodes[first];
          const b = nodes[second];

          if (Math.abs(a.layer - b.layer) > 1) {
            continue;
          }

          const distance = Math.hypot(a.x - b.x, a.y - b.y);

          if (distance < CONNECT_DIST) {
            const base = 1 - distance / CONNECT_DIST;
            const alpha = base * 0.35 * (0.4 + 0.3 * (a.layer + b.layer)) * lineMultiplier;
            context.strokeStyle = `rgba(${color.line},${alpha.toFixed(3)})`;
            context.lineWidth = 0.5 + base * (isActive ? 1.05 : 0.8);
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }

      for (const node of nodes) {
        const breathe = 0.55 + 0.45 * Math.sin(node.phase);
        const layerBrightness = node.layer === 2 ? 1 : node.layer === 1 ? 0.7 : 0.45;
        const haloRadius = node.r * (node.layer === 2 ? 9 : 6);
        const gradient = context.createRadialGradient(node.x, node.y, 0, node.x, node.y, haloRadius);

        gradient.addColorStop(0, `rgba(${color.node},${(0.45 * breathe * layerBrightness * nodeMultiplier).toFixed(3)})`);
        gradient.addColorStop(0.4, `rgba(${color.node},${(0.12 * breathe * layerBrightness * nodeMultiplier).toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${color.node},0)`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(node.x, node.y, haloRadius, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = `rgba(${color.accent},${(0.85 * breathe * layerBrightness * nodeMultiplier).toFixed(3)})`;
        context.beginPath();
        context.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        context.fill();
      }

      pulses = pulses.filter((pulse) => pulse.t < 1);

      for (const pulse of pulses) {
        if (animated) {
          pulse.t += pulse.speed;
        }

        const from = nodes[pulse.from];
        const to = nodes[pulse.to];

        if (!from || !to) {
          continue;
        }

        const x = from.x + (to.x - from.x) * pulse.t;
        const y = from.y + (to.y - from.y) * pulse.t;
        const fade = Math.sin(pulse.t * Math.PI);
        const radius = 4.5;
        const gradient = context.createRadialGradient(x, y, 0, x, y, radius * 2.5);

        gradient.addColorStop(0, `rgba(${color.pulse},${(0.95 * fade).toFixed(3)})`);
        gradient.addColorStop(0.5, `rgba(${color.pulse},${(0.4 * fade).toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${color.pulse},0)`);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius * 2.5, 0, Math.PI * 2);
        context.fill();
      }

      if (animated && now - lastSpawn > pulseInterval) {
        spawnPulse();
        lastSpawn = now;
      }
    }

    function frame(now: number) {
      if (!running) {
        return;
      }

      draw(now, true);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || reduceMotion || document.hidden) {
        return;
      }

      running = true;
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function handleResize() {
      resize();
      seed();
      draw(0, false);
    }

    function handleMouseMove(event: MouseEvent) {
      const rect = canvasElement.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
    }

    function handleMouseOut() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    }

    resize();
    seed();
    draw(0, false);
    start();

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseout", handleMouseOut);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseout", handleMouseOut);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intensity]);

  return <canvas ref={canvasRef} aria-hidden="true" className="neural-background-canvas" />;
}
