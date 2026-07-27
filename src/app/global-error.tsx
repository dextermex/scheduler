"use client";

/**
 * Root error boundary — catches errors in the root layout itself (where the
 * segment-level error.tsx can't reach). Must render its own <html>/<body>.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          textAlign: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#0b1020",
          color: "#e8ecf6",
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>This page hit a snag</h1>
        <p style={{ color: "#9aa6c4", maxWidth: 420 }}>
          The scheduler couldn&rsquo;t load just now. This is usually temporary — try again.
        </p>
        <button
          onClick={() => reset()}
          style={{
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
      </body>
    </html>
  );
}
