/**
 * Vet-Rate.org - Top-level Error Boundary
 * Copyright (c) 2024-2026 Anthony Johnson
 *
 * React renders nothing if any descendant throws during render. Without an
 * error boundary the user sees a blank white page and loses any unsaved
 * Tactical Calculator / Witness Bench / packet work in progress.
 *
 * This component catches the error, surfaces it for the veteran with an
 * actionable recovery path, and keeps any bug-report context (the stack)
 * locally — nothing is shipped off-device.
 */

import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console only — privacy-first means we do not phone home with
    // user content. Veterans can copy/paste from devtools if they choose.
    console.error("[ErrorBoundary] Uncaught render error:", error, info);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error, info } = this.state;
    const stack =
      (error && (error.stack || error.message)) ||
      (info && info.componentStack) ||
      "Unknown error";

    return (
      <div
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          backgroundColor: "#0f172a",
          color: "#f8fafc",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: "44rem",
            width: "100%",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "0.75rem",
            padding: "1.5rem",
          }}
        >
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.75rem",
            }}
          >
            Something went wrong.
          </h1>
          <p style={{ marginBottom: "1rem", lineHeight: 1.5 }}>
            Vet-Rate hit an unexpected error while rendering. Your saved data
            (Bunker backups, Tactical Calculator entries, packet) lives in your
            browser and is unaffected. Try the buttons below; if it persists,
            copy the technical detail and file an issue.
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
            }}
          >
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#475569",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Reload page
            </button>
          </div>

          <details>
            <summary style={{ cursor: "pointer", color: "#94a3b8" }}>
              Technical detail (for bug reports)
            </summary>
            <pre
              style={{
                marginTop: "0.75rem",
                padding: "0.75rem",
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "0.375rem",
                overflow: "auto",
                fontSize: "0.75rem",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {stack}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
