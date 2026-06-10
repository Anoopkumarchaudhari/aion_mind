"use client";

import { Mic2, Podcast, Radio } from "lucide-react";
import { AppFrame } from "@/components/AppFrame";

const podcastCards = [
  { title: "Brief", label: "5 min", icon: Mic2 },
  { title: "Episode", label: "15 min", icon: Podcast },
  { title: "Series", label: "Multi-part", icon: Radio }
];

export function PodcastPageContent() {
  return (
    <AppFrame title="Podcast">
      <section className="route-content podcast-route">
        <div className="podcast-shell">
          <div className="podcast-heading">
            <span className="artifact-icon podcast-icon">
              <Podcast size={19} />
            </span>
            <div>
              <p className="eyebrow">Podcast studio</p>
              <h2>Podcast</h2>
            </div>
          </div>

          <div className="podcast-card-grid">
            {podcastCards.map((card) => {
              const Icon = card.icon;

              return (
                <article className="podcast-card" key={card.title}>
                  <Icon size={19} />
                  <h3>{card.title}</h3>
                  <p>{card.label}</p>
                </article>
              );
            })}
          </div>

          <div className="podcast-compose">
            <textarea placeholder="Podcast topic..." />
            <button className="ghost-button" type="button" disabled>
              Create Podcast
            </button>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
