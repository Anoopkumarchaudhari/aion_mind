import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AriaMindX — Aria Mind X AI Assistant",
    short_name: "AriaMindX",
    description:
      "AriaMindX (Aria Mind X) all-in-one AI assistant for chat, search, images, video, notebooks and more.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/Aria%20logo/aria-icon.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
