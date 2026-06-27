"use client";

type AionLogoProps = {
  size: number;
  decorative?: boolean;
};

export function AionLogo({ size, decorative = false }: AionLogoProps) {
  return (
    <img
      className="aion-mark"
      src="/Aria%20logo/aria-icon.png"
      width={size}
      height={size}
      alt={decorative ? "" : "AriaMindX"}
      aria-hidden={decorative || undefined}
      draggable={false}
    />
  );
}
