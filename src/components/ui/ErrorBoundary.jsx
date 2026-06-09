import React from "react";
import { Card } from "./Card";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    console.error("Error de pantalla capturado", error, info);
  }

  render() {
    if (this.state.error) {
      const content = (
        <>
          <h2 className="text-xl font-bold text-ink">No se pudo cargar esta vista.</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            La app evitó una pantalla en blanco. Puedes recargarla o volver al inicio.
          </p>
          {(import.meta.env.DEV || import.meta.env.VITE_STAGING_BADGE === "true") && (
            <p className="mt-3 break-words rounded-lg bg-ink/5 p-3 font-mono text-xs text-ink/70">
              {this.state.error?.message || "Error desconocido"}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Recargar app
            </button>
            <button
              type="button"
              className="rounded-lg border border-ink/15 px-4 py-2 text-sm font-semibold text-ink"
              onClick={() => {
                window.location.hash = "#/";
                window.location.reload();
              }}
            >
              Volver al inicio
            </button>
          </div>
        </>
      );

      if (this.props.root) {
        return (
          <main className="grid min-h-dvh place-items-center bg-paper p-5">
            <div className="w-full max-w-xl rounded-xl border border-ink/10 bg-white p-6 shadow-soft dark:bg-neutral-900">
              {content}
            </div>
          </main>
        );
      }

      return <Card>{content}</Card>;
    }

    return this.props.children;
  }
}
