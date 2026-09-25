"use client";

import { useState } from "react";

export function CopyButton({
  value,
  label = "Copiar link",
}: {
  value: string;
  label?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          // clipboard indisponível — ignora
        }
      }}
      className="btn btn-outline btn-sm"
    >
      {copiado ? "Copiado!" : label}
    </button>
  );
}
