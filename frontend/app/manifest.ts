import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Delveworn · Local Practice Mode",
    short_name: "Delveworn",
    description:
      "A browser-playable dungeon crawler with local randomness and no wallet, VRF or transactions.",
    start_url: "/practice",
    display: "standalone",
    background_color: "#071012",
    theme_color: "#22d3ee",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
