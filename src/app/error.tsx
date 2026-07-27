"use client";

/**
 * Route-level error boundary. Catches any render/runtime error in the app
 * segment and shows a friendly retry instead of a raw 500 — important because
 * this app is embedded in the AURA dashboard's Scheduler tab, so a transient
 * blip (e.g. a redeploy window) should offer a reload, not a scary error code.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        textAlign: "center",
        padding: 24,
        color: "#e8ecf6",
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>This page hit a snag</h1>
      <p style={{ color: "#9aa6c4", maxWidth: 420, margin: 0 }}>
        The scheduler couldn&rsquo;t load just now. This is usually temporary — try again in a
        moment.
      </p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: 6,
          padding: "10px 18px",
          borderRadius: 10,
          border: "none",
          background: "#ff5fb2",
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        Reload
      </button>
    </div>
  );
}
