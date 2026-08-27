import { ImageResponse } from "next/og";

export const alt = "Delveworn — browser-playable local practice mode";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#071012",
          color: "#f5f5f5",
          fontFamily: "sans-serif",
          letterSpacing: "-0.02em",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            border: "8px solid #22d3ee",
            borderRadius: 34,
            marginBottom: 42,
            fontSize: 58,
            fontWeight: 800,
          }}
        >
          DW
        </div>
        <div
          style={{
            color: "#22d3ee",
            fontSize: 24,
            letterSpacing: "0.38em",
            marginBottom: 14,
          }}
        >
          LOCAL PRACTICE MODE
        </div>
        <div
          style={{
            fontSize: 82,
            fontWeight: 800,
            lineHeight: 1,
            marginBottom: 24,
          }}
        >
          DELVEWORN
        </div>
        <div
          style={{
            color: "#a1a1aa",
            fontSize: 32,
          }}
        >
          Browser dungeon crawler · No wallet · No VRF
        </div>
      </div>
    ),
    size
  );
}
