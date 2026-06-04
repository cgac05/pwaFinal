import { useState } from "react";
import type { NewsSourceInput } from "../../services/newsTeam06/newsTeam06Api";

interface SourceInputProps {
  symbol: string;
  onAdd: (source: NewsSourceInput) => void;
}

export function SourceInput({ symbol, onAdd }: SourceInputProps) {
  const [mode, setMode] = useState<"text" | "url">("text");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");

  const addSource = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    onAdd({
      id: `manual-${Date.now()}`,
      title: title.trim() || `${symbol} fuente manual`,
      ...(mode === "url" ? { url: trimmed } : { text: trimmed }),
      provider: mode === "url" ? "url" : "manual",
      symbol
    });
    setTitle("");
    setValue("");
  };

  return (
    <div className="team06-source-input">
      <div className="team06-source-input__header">
        <div>
          <h3>Agregar fuente TNMT</h3>
          <p>Pega una URL o texto de noticia para analizar sentimiento, credibilidad y señal.</p>
        </div>
        <div className="team06-segmented">
          <button type="button" className={mode === "text" ? "is-active" : ""} onClick={() => setMode("text")}>Texto</button>
          <button type="button" className={mode === "url" ? "is-active" : ""} onClick={() => setMode("url")}>URL</button>
        </div>
      </div>

      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Título opcional"
        className="team06-input"
      />
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={mode === "url" ? "https://..." : "Pega aquí el contenido de la noticia..."}
        className="team06-textarea"
      />
      <button type="button" className="team06-primary-button" onClick={addSource} disabled={!value.trim()}>
        Agregar fuente
      </button>
    </div>
  );
}

