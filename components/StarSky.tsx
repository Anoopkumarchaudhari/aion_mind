type StarSkyProps = {
  dimmed?: boolean;
};

/**
 * Real night-sky backdrop: deep black canvas, a faint nebula haze, three
 * parallax star layers that drift and twinkle, and occasional shooting stars.
 * Reuses the auth-page sky animations. Edge fades keep chat content legible.
 */
export function StarSky({ dimmed = false }: StarSkyProps) {
  return (
    <div className={`star-sky ${dimmed ? "is-dimmed" : ""}`} aria-hidden="true">
      <div className="star-sky-base" />
      <div className="star-sky-nebula" />
      <div className="star-sky-layer star-sky-far" />
      <div className="star-sky-layer star-sky-mid" />
      <div className="star-sky-layer star-sky-near" />
      <span className="star-sky-shooting star-sky-shooting-one" />
      <span className="star-sky-shooting star-sky-shooting-two" />
      <div className="star-sky-readability" />
      <div className="star-sky-edge is-top" />
      <div className="star-sky-edge is-bottom" />
    </div>
  );
}
