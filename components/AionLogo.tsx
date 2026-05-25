"use client";

type AionLogoProps = {
  size: number;
  decorative?: boolean;
};

export function AionLogo({ size, decorative = false }: AionLogoProps) {
  return (
    <img
      className="aion-mark"
      src="/aion-mind-logo.jpg"
      width={size}
      height={size}
      alt={decorative ? "" : "Aion Mind"}
      aria-hidden={decorative || undefined}
      draggable={false}
    />
  );
}
