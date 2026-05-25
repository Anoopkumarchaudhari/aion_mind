import { NeuralBackground } from "@/components/NeuralBackground";

type NeuralBackdropProps = {
  dimmed?: boolean;
  intensity?: "normal" | "active";
};

export function NeuralBackdrop({ dimmed = false, intensity = "normal" }: NeuralBackdropProps) {
  return (
    <div className={`neural-backdrop ${intensity === "active" ? "is-active" : ""}`} aria-hidden="true">
      <div className="neural-backdrop-base" />
      <div className={`neural-network-layer ${dimmed ? "is-dimmed" : ""}`}>
        <NeuralBackground intensity={intensity} />
      </div>
      <div className="neural-center-glow" />
      <div className="neural-backdrop-readability" />
      <div className="neural-edge-fade is-top" />
      <div className="neural-edge-fade is-bottom" />
    </div>
  );
}
