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
      return (
        <Card>
          <h2 className="text-xl font-bold text-ink">No se pudo cargar esta sección.</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            La app evitó una pantalla en blanco. Recarga la sección o vuelve al inicio.
          </p>
        </Card>
      );
    }

    return this.props.children;
  }
}
