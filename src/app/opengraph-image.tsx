import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FLUX — Business Management Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0f0e0a 0%, #1a150a 50%, #2a1f0a 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Dot pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.05,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Kente stripe accent at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#d97706" }} />
          <div style={{ flex: 1, background: "#16a34a" }} />
          <div style={{ flex: 1, background: "#1e40af" }} />
        </div>

        {/* Logo */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 20,
            background: "#d97706",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
            boxShadow: "0 8px 32px rgba(217,119,6,0.4)",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: "-0.03em",
            }}
          >
            F
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "white",
            letterSpacing: "-0.03em",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          FLUX
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: 24,
            color: "rgba(255,255,255,0.5)",
            marginTop: 16,
            letterSpacing: "0.02em",
          }}
        >
          Business Management Platform
        </p>

        {/* Tagline */}
        <p
          style={{
            fontSize: 18,
            color: "#d97706",
            marginTop: 24,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          POS · Inventory · Invoicing · Accounting
        </p>

        {/* Domain */}
        <p
          style={{
            position: "absolute",
            bottom: 32,
            fontSize: 16,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.05em",
          }}
        >
          fluxtz.com
        </p>

        {/* Kente stripe at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            display: "flex",
          }}
        >
          <div style={{ flex: 1, background: "#d97706" }} />
          <div style={{ flex: 1, background: "#16a34a" }} />
          <div style={{ flex: 1, background: "#1e40af" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
