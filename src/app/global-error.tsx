"use client";

import { useEffect } from "react";

/** Solo se dispara si el propio layout raíz falla — error.tsx cubre el resto de la app. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", background: "#f8fafc" }}>
          <div style={{ maxWidth: "24rem", textAlign: "center", padding: "2rem" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#0f172a" }}>Algo salió mal</h1>
            <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
              No pudimos cargar la aplicación. Intenta de nuevo en unos momentos.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: "1rem",
                width: "100%",
                borderRadius: "0.375rem",
                background: "#0f172a",
                color: "white",
                padding: "0.625rem 0.75rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
