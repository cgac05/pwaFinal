import React, { useCallback, useState, useEffect, useRef } from "react";
import { useSignalStore } from "../../store/signals";
import {
  fetchResults,
  sendGlobalChat,
  type MockResult,
  type ChatMessage
} from "../../services/ai/volatilityAnalysisApi";
import {
  MessageSquare,
  Cpu,
  Sparkles,
  Send,
  Layers,
  HelpCircle,
  Activity,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Trash2,
  ArrowRight,
  RefreshCw,
  X
} from "lucide-react";

interface ExtendedChatMessage extends ChatMessage {
  id: string;
  modelUsed?: string;
  status?: "pending" | "completed" | "error";
}

interface GlobalChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isInline?: boolean;
}

export function GlobalChatDrawer({ isOpen, onClose, isInline = false }: GlobalChatDrawerProps) {
  const { selectedInstrument } = useSignalStore();
  const activeTicker = selectedInstrument?.symbol ?? "SPY";

  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [results, setResults] = useState<MockResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'primary' | 'fallback'>('primary');
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showReports, setShowReports] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadEvaluationResults = useCallback(async () => {
    setLoadingResults(true);
    try {
      const data = await fetchResults();
      setResults(data);
    } catch (err) {
      console.error("Error al cargar historial de volatilidad:", err);
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    void loadEvaluationResults();
  }, [loadEvaluationResults]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = useCallback(async (customQuestion?: string) => {
    const question = (customQuestion ?? input).trim();
    if (!question || loading) return;

    if (!customQuestion) {
      setInput("");
    }
    setErrorMsg(null);
    setLoading(true);

    const userMessageId = `user-${Date.now()}`;
    const newUserMessage: ExtendedChatMessage = {
      id: userMessageId,
      role: "user",
      content: question,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, newUserMessage]);

    const assistantMessageId = `ai-${Date.now()}`;
    const newAssistantMessage: ExtendedChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "Analizando reportes y formulando veredicto...",
      timestamp: new Date().toISOString(),
      status: "pending"
    };

    setMessages(prev => [...prev, newAssistantMessage]);

    try {
      const apiMessage = isInline ? question : `[Activo: ${activeTicker}] ${question}`;
      const reply = await sendGlobalChat(apiMessage, selectedModel);

      let currentIndex = 0;
      const replyText = reply.text;
      const typingSpeed = 6;
      const chunkSize = 4;

      const intervalId = setInterval(() => {
        if (currentIndex >= replyText.length) {
          clearInterval(intervalId);
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: replyText, modelUsed: reply.model, status: "completed" }
              : msg
          ));
          setLoading(false);
        } else {
          currentIndex += chunkSize;
          const nextText = replyText.slice(0, currentIndex);
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? { ...msg, content: nextText + "▌", status: "completed" }
              : msg
          ));
        }
      }, typingSpeed);

    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo conectar con el modelo Gemini.";
      setErrorMsg(message);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: `Error de Auditoría: No se pudo obtener respuesta del modelo. Detalle: ${message}`, status: "error" }
          : msg
      ));
      setLoading(false);
    }
  }, [input, loading, selectedModel, activeTicker, isInline]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setErrorMsg(null);
  };

  const injectSuggestion = (q: string) => {
    setInput(q);
  };

  const injectResultQuestion = (ticker: string, decision: string) => {
    const question = `¿Por qué el reporte de ${ticker} se evaluó como ${decision}? Analiza detalladamente sus scores de volatilidad.`;
    setInput(question);
  };

  // ==========================================
  // 1. INLINE MODE
  // ==========================================
  if (isInline) {
    return (
      <div style={{
        display: "flex",
        gap: "1.5rem",
        height: "calc(100vh - 4.5rem)",
        maxHeight: "calc(100vh - 4.5rem)",
        padding: "0.5rem 0",
        fontFamily: "var(--font-family)"
      }}>

        {/* SIDEBAR LEFT: EVALUATED ASSETS PANEL */}
        <div style={{
          width: "320px",
          background: "rgba(10, 15, 26, 0.4)",
          backdropFilter: "blur(16px)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--color-border)",
            background: "rgba(255, 255, 255, 0.02)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Layers size={18} color="var(--color-accent)" />
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
                Reportes de Volatilidad
              </h3>
            </div>
            <button
              className="btn-ghost"
              onClick={loadEvaluationResults}
              disabled={loadingResults}
              style={{ padding: "0.3rem", borderRadius: "50%", display: "flex", alignItems: "center" }}
              title="Refrescar reportes"
            >
              <RefreshCw size={12} style={{ color: "var(--color-text-muted)" }} />
            </button>
          </div>

          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.85rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem"
          }}>
            {loadingResults && results.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.5rem" }}>
                <div className="skeleton" style={{ width: "24px", height: "24px", borderRadius: "50%" }} />
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>Cargando catálogo...</span>
              </div>
            ) : results.length === 0 ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                padding: "1.5rem",
                textAlign: "center",
                gap: "1rem"
              }}>
                <AlertCircle size={32} color="var(--color-hold)" />
                <div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                    No se han encontrado reportes de evaluación analizados.
                  </p>
                  <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "var(--color-text-muted)", opacity: 0.7 }}>
                    Debes correr el simulador primero.
                  </p>
                </div>
                <span
                  className="btn-primary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    fontSize: "0.75rem",
                    padding: "0.4rem 0.8rem"
                  }}
                >
                  Ir a Evaluar
                  <ArrowRight size={12} />
                </span>
              </div>
            ) : (
              results.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.015)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.75rem",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem"
                  }}
                  className="card-hover-highlight"
                  onClick={() => injectResultQuestion(item.ticker, item.decision)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <Activity size={13} color="var(--color-accent)" />
                      <span style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--color-text)" }}>
                        {item.ticker}
                      </span>
                    </div>
                    <span style={{
                      fontSize: "0.65rem",
                      fontWeight: 900,
                      padding: "0.15rem 0.45rem",
                      borderRadius: "var(--radius-pill)",
                      background: item.decision === "SÍ" ? "rgba(63, 185, 80, 0.12)" : "rgba(248, 81, 73, 0.12)",
                      color: item.decision === "SÍ" ? "var(--color-buy)" : "var(--color-sell)",
                      border: `1px solid ${item.decision === 'SÍ' ? 'rgba(63, 185, 80, 0.2)' : 'rgba(248, 81, 73, 0.2)'}`
                    }}>
                      {item.decision}
                    </span>
                  </div>

                  <div style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.scores.replace(/\n/g, " • ")}
                  </div>

                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "0.25rem",
                    paddingTop: "0.4rem",
                    borderTop: "1px solid rgba(255,255,255,0.03)"
                  }}>
                    <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", opacity: 0.6 }}>
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                    <button
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        fontSize: "0.68rem",
                        color: "var(--color-accent)",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "0.2rem",
                        cursor: "pointer"
                      }}
                    >
                      Preguntar
                      <ChevronRight size={10} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{
            padding: "0.85rem 1rem",
            background: "rgba(255, 193, 7, 0.02)",
            borderTop: "1px solid var(--color-border)"
          }}>
            <p style={{ margin: 0, fontSize: "0.7rem", color: "var(--color-hold)", lineHeight: 1.4, display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <HelpCircle size={12} />
              <span>Los datos cargados son equivalentes a los PDFs exportables del sistema.</span>
            </p>
          </div>
        </div>

        {/* CHAT PANEL RIGHT */}
        <div style={{
          flex: 1,
          background: "rgba(10, 15, 26, 0.4)",
          backdropFilter: "blur(16px)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--color-border)",
            background: "rgba(255, 255, 255, 0.02)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem"
          }}>
            <div>
              <h2 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--color-text)", margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <MessageSquare size={18} color="var(--color-accent)" />
                Chat IA — Auditoría Cuantitativa de Volatilidad
              </h2>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                Consulta histórica inteligente de viabilidad y reportes de opciones.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.7rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                Modelo IA:
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Cpu size={14} style={{ position: "absolute", left: "0.6rem", color: "var(--color-accent)" }} />
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value as 'primary' | 'fallback')}
                  style={{
                    padding: "0.4rem 0.65rem 0.4rem 1.8rem",
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-text)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    outline: "none"
                  }}
                >
                  <option value="primary">Gemma 4 31B (Primario)</option>
                  <option value="fallback">Gemma 4 26B (Fallback)</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem"
          }}>
            {messages.length === 0 ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                maxWidth: "600px",
                margin: "0 auto",
                textAlign: "center",
                gap: "1.5rem",
                padding: "1rem"
              }}>
                <div style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "rgba(73, 79, 223, 0.1)",
                  border: "1px solid rgba(73, 79, 223, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 15px rgba(73, 79, 223, 0.15)"
                }}>
                  <Sparkles size={26} color="var(--color-accent)" />
                </div>

                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: 0, color: "var(--color-text)" }}>
                    Auditoría de Volatilidad con Gemini
                  </h3>
                  <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.85rem", color: "var(--color-text-muted)", lineHeight: 1.5 }}>
                    Este chat lee automáticamente los reportes y coeficientes analizados en tu Tabla de Evaluación. Puedes hacer comparativas de viabilidad, preguntar el porqué de una decisión técnica o simular coberturas de riesgo.
                  </p>
                </div>

                <div style={{ width: "100%" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.75rem", letterSpacing: "0.05em" }}>
                    Sugerencias Rápidas
                  </span>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "0.75rem",
                    textAlign: "left"
                  }}>
                    <button
                      onClick={() => injectSuggestion("Dame un resumen comparativo de todos los activos analizados hasta ahora.")}
                      className="btn-ghost card-hover-highlight"
                      style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", fontSize: "0.78rem", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "0.2rem" }}
                    >
                      <strong style={{ color: "var(--color-accent)" }}>Comparar Activos</strong>
                      <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}>Resumen cruzado del portafolio.</span>
                    </button>

                    <button
                      onClick={() => injectSuggestion("¿Cuál es la justificación técnica del reporte más reciente de la tabla?")}
                      className="btn-ghost card-hover-highlight"
                      style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", fontSize: "0.78rem", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "0.2rem" }}
                    >
                      <strong style={{ color: "var(--color-accent)" }}>Último Reporte</strong>
                      <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}>Analizar la última corrida ejecutada.</span>
                    </button>

                    <button
                      onClick={() => injectSuggestion("¿Cuáles son los principales riesgos que descartan una estrategia en las corridas con veredicto NO?")}
                      className="btn-ghost card-hover-highlight"
                      style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", fontSize: "0.78rem", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "0.2rem" }}
                    >
                      <strong style={{ color: "var(--color-accent)" }}>Auditoría de Veredicto NO</strong>
                      <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}>Riesgos y justificaciones de descarte.</span>
                    </button>

                    <button
                      onClick={() => injectSuggestion("Explica cómo influye un Score de Opciones alto en la viabilidad de un Iron Condor.")}
                      className="btn-ghost card-hover-highlight"
                      style={{ padding: "0.75rem", borderRadius: "var(--radius-md)", fontSize: "0.78rem", border: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: "0.2rem" }}
                    >
                      <strong style={{ color: "var(--color-accent)" }}>Score de Opciones</strong>
                      <span style={{ color: "var(--color-text-muted)", fontSize: "0.7rem" }}>Impacto técnico de indicadores.</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem"
                  }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    fontSize: "0.68rem",
                    color: "var(--color-text-muted)",
                    alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                    padding: "0 0.2rem"
                  }}>
                    {msg.role === "user" ? (
                      <span style={{ fontWeight: 800 }}>TÚ (OPERADOR)</span>
                    ) : (
                      <>
                        <span style={{ fontWeight: 800, color: "var(--color-accent)" }}>AUDITOR CUANTITATIVO</span>
                        {msg.modelUsed && (
                          <span style={{
                            fontSize: "0.6rem",
                            background: "var(--color-accent-subtle)",
                            color: "var(--color-accent)",
                            padding: "0.05rem 0.35rem",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid rgba(73, 79, 223, 0.25)"
                          }}>
                            {msg.modelUsed.includes("gemini") ? "Gemini" : msg.modelUsed}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{
                    padding: "0.85rem 1.1rem",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    background: msg.role === "user"
                      ? "linear-gradient(135deg, rgba(73, 79, 223, 0.15) 0%, rgba(73, 79, 223, 0.08) 100%)"
                      : "rgba(255, 255, 255, 0.03)",
                    border: msg.role === "user"
                      ? "1px solid rgba(73, 79, 223, 0.3)"
                      : "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    whiteSpace: "pre-wrap"
                  }}>
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            {loading && messages.length > 0 && messages[messages.length - 1].status === "pending" && (
              <div style={{
                alignSelf: "flex-start",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1rem",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-muted)",
                fontSize: "0.8rem",
                maxWidth: "200px"
              }}>
                <div className="skeleton" style={{ width: "8px", height: "8px", borderRadius: "50%" }} />
                <span>Gemini formulando respuesta...</span>
              </div>
            )}

            {errorMsg && (
              <div style={{
                alignSelf: "center",
                padding: "0.6rem 1rem",
                borderRadius: "var(--radius-md)",
                background: "rgba(248, 81, 73, 0.12)",
                border: "1px solid var(--color-sell)",
                color: "var(--color-sell)",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem"
              }}>
                <AlertCircle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--color-border)",
            background: "rgba(255, 255, 255, 0.01)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem"
          }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
              <button
                onClick={clearChat}
                disabled={messages.length === 0 || loading}
                className="btn-ghost"
                style={{
                  padding: "0.65rem",
                  borderRadius: "var(--radius-sm)",
                  borderColor: "var(--color-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "44px",
                  width: "44px"
                }}
                title="Limpiar chat"
              >
                <Trash2 size={16} style={{ color: messages.length === 0 ? "var(--color-text-muted)" : "var(--color-sell)" }} />
              </button>

              <div style={{ flex: 1, position: "relative" }}>
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ej: ¿Cuáles son las fortalezas técnicas de SPY comparado con AAPL según los scores del historial?"
                  disabled={loading}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "0.75rem 1rem",
                    background: "var(--color-surface-raised)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--color-text)",
                    fontSize: "0.88rem",
                    resize: "none",
                    fontFamily: "inherit",
                    lineHeight: 1.4,
                    outline: "none"
                  }}
                />
              </div>

              <button
                className="btn-primary"
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                style={{
                  padding: "0 1.5rem",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: 700
                }}
              >
                <span>{loading ? "..." : "Enviar"}</span>
                <Send size={14} />
              </button>
            </div>

            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "0.68rem",
              color: "var(--color-text-muted)",
              padding: "0 0.2rem"
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <CheckCircle size={10} color="var(--color-buy)" />
                <span>Conectado a la API de Gemini mediante canal de auditoría local.</span>
              </span>
              <span>Máximo de tokens optimizado mediante indexación compacta.</span>
            </div>
          </div>
        </div>

      </div>
    );
  }

  // ==========================================
  // 2. SLIDING DRAWER MODE
  // ==========================================
  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0, 0, 0, 0.45)",
            backdropFilter: "blur(4px)",
            zIndex: 999,
            transition: "opacity 0.25s ease"
          }}
        />
      )}

      <div
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          height: "100vh",
          width: "420px",
          maxWidth: "100vw",
          background: "var(--color-surface)",
          backdropFilter: "blur(20px)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.6)",
          zIndex: 1000,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          fontFamily: "var(--font-family)"
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: "1.2rem 1.5rem",
          borderBottom: "1px solid var(--color-border)",
          background: "rgba(255, 255, 255, 0.02)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Sparkles size={20} color="var(--color-accent)" />
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 850, color: "var(--color-text)", margin: 0, letterSpacing: "-0.01em" }}>
                Copilot IA
              </h2>
              <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", fontWeight: 500 }}>
                Auditoría Cuantitativa y Coeficientes
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            style={{
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: 0
            }}
            title="Cerrar Copilot"
          >
            <X size={16} style={{ color: "var(--color-text-muted)" }} />
          </button>
        </div>

        {/* Model selector */}
        <div style={{
          padding: "0.75rem 1.5rem",
          borderBottom: "1px solid var(--color-border)",
          background: "rgba(255, 255, 255, 0.01)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span style={{ fontSize: "0.68rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
            Cerebro IA
          </span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value as 'primary' | 'fallback')}
            style={{
              padding: "0.25rem 0.5rem",
              background: "var(--color-surface-raised)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--color-text)",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              outline: "none"
            }}
          >
            <option value="primary">Gemma 4 31B</option>
            <option value="fallback">Gemma 4 26B</option>
          </select>
        </div>

        {/* Active ticker banner */}
        <div style={{
          padding: "0.5rem 1.5rem",
          background: "var(--color-accent-subtle)",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem"
        }}>
          <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-buy)", boxShadow: "0 0 6px var(--color-buy)" }} />
          <span style={{ fontSize: "0.72rem", color: "var(--color-text-muted)" }}>
            Activo en Dashboard: <strong style={{ color: "var(--color-accent)" }}>{activeTicker}</strong>
          </span>
        </div>

        {/* Collapsible reports section */}
        <div style={{ borderBottom: "1px solid var(--color-border)" }}>
          <button
            onClick={() => setShowReports(!showReports)}
            style={{
              width: "100%",
              padding: "0.75rem 1.5rem",
              background: "rgba(255, 255, 255, 0.015)",
              border: "none",
              color: "var(--color-text)",
              fontSize: "0.78rem",
              fontWeight: 700,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
              outline: "none"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Layers size={13} color="var(--color-accent)" />
              Reportes de Volatilidad ({results.length})
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
              {showReports ? "▲ Ocultar" : "▼ Desplegar"}
            </span>
          </button>

          {showReports && (
            <div style={{
              maxHeight: "180px",
              overflowY: "auto",
              padding: "0.75rem 1.25rem",
              background: "rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              borderTop: "1px solid rgba(255,255,255,0.03)"
            }}>
              {loadingResults && results.length === 0 ? (
                <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                  Cargando...
                </div>
              ) : results.length === 0 ? (
                <div style={{ padding: "1rem", textAlign: "center", fontSize: "0.7rem", color: "var(--color-text-muted)" }}>
                  Sin reportes. Corre la simulación primero.
                </div>
              ) : (
                results.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      injectResultQuestion(item.ticker, item.decision);
                      setShowReports(false);
                    }}
                    style={{
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.5rem 0.65rem",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.2s"
                    }}
                    className="card-hover-highlight"
                  >
                    <div>
                      <strong style={{ fontSize: "0.8rem", color: "var(--color-text)", marginRight: "0.4rem" }}>{item.ticker}</strong>
                      <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)" }}>{item.scores.replace(/\n/g, " • ")}</span>
                    </div>
                    <span style={{
                      fontSize: "0.6rem",
                      fontWeight: 800,
                      padding: "0.1rem 0.35rem",
                      borderRadius: 3,
                      background: item.decision === "SÍ" ? "rgba(63, 185, 80, 0.1)" : "rgba(248, 81, 73, 0.1)",
                      color: item.decision === "SÍ" ? "var(--color-buy)" : "var(--color-sell)",
                      border: `1px solid ${item.decision === 'SÍ' ? 'rgba(63, 185, 80, 0.2)' : 'rgba(248, 81, 73, 0.2)'}`
                    }}>
                      {item.decision}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem"
        }}>
          {messages.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              textAlign: "center",
              gap: "1.25rem",
              padding: "0 0.5rem"
            }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(73, 79, 223, 0.1)",
                border: "1px solid rgba(73, 79, 223, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 12px rgba(73, 79, 223, 0.1)"
              }}>
                <Sparkles size={22} color="var(--color-accent)" />
              </div>

              <div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: 0, color: "var(--color-text)" }}>
                  Asistente Cuantitativo Copilot
                </h3>
                <p style={{ margin: "0.4rem 0 0 0", fontSize: "0.8rem", color: "var(--color-text-muted)", lineHeight: 1.45 }}>
                  Consúltame sobre los activos analizados en el Dashboard, coeficientes de opciones o mitigaciones de riesgo. Leo tus reportes automáticamente.
                </p>
              </div>

              <div style={{ width: "100%" }}>
                <span style={{ fontSize: "0.65rem", color: "var(--color-text-muted)", fontWeight: 700, textTransform: "uppercase", display: "block", marginBottom: "0.5rem", letterSpacing: "0.04em" }}>
                  Sugerencias Rápidas
                </span>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", textAlign: "left" }}>
                  <button
                    onClick={() => injectSuggestion("Dame un resumen comparativo de todos los activos analizados hasta ahora.")}
                    className="btn-ghost card-hover-highlight"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", fontSize: "0.75rem", border: "1px solid var(--color-border)", textAlign: "left" }}
                  >
                    <strong>Comparar Activos</strong>
                  </button>

                  <button
                    onClick={() => injectSuggestion("¿Cuál es la justificación técnica del reporte más reciente de la tabla?")}
                    className="btn-ghost card-hover-highlight"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", fontSize: "0.75rem", border: "1px solid var(--color-border)", textAlign: "left" }}
                  >
                    <strong>Último Reporte</strong>
                  </button>

                  <button
                    onClick={() => injectSuggestion("¿Cuáles son los principales riesgos que descartan una estrategia en las corridas con veredicto NO?")}
                    className="btn-ghost card-hover-highlight"
                    style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)", fontSize: "0.75rem", border: "1px solid var(--color-border)", textAlign: "left" }}
                  >
                    <strong>Auditoría de Veredicto NO</strong>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem"
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                  fontSize: "0.62rem",
                  color: "var(--color-text-muted)",
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  padding: "0 0.15rem"
                }}>
                  {msg.role === "user" ? (
                    <span style={{ fontWeight: 800 }}>OPERADOR</span>
                  ) : (
                    <>
                      <span style={{ fontWeight: 800, color: "var(--color-accent)" }}>COPILOT IA</span>
                      {msg.modelUsed && (
                        <span style={{
                          fontSize: "0.55rem",
                          background: "rgba(73, 79, 223, 0.1)",
                          color: "var(--color-accent)",
                          padding: "0.02rem 0.25rem",
                          borderRadius: 3
                        }}>
                          Gemma
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div style={{
                  padding: "0.75rem 0.95rem",
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  fontSize: "0.85rem",
                  lineHeight: 1.45,
                  background: msg.role === "user"
                    ? "var(--color-accent-subtle)"
                    : "rgba(255, 255, 255, 0.025)",
                  border: msg.role === "user"
                    ? "1px solid rgba(73, 79, 223, 0.25)"
                    : "1px solid var(--color-border)",
                  color: "var(--color-text)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                  whiteSpace: "pre-wrap"
                }}>
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {loading && messages.length > 0 && messages[messages.length - 1].status === "pending" && (
            <div style={{
              alignSelf: "flex-start",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 0.85rem",
              borderRadius: "8px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)",
              fontSize: "0.75rem",
              maxWidth: "180px"
            }}>
              <div className="skeleton" style={{ width: "6px", height: "6px", borderRadius: "50%" }} />
              <span>Copilot analizando...</span>
            </div>
          )}

          {errorMsg && (
            <div style={{
              alignSelf: "center",
              padding: "0.5rem 0.85rem",
              borderRadius: "var(--radius-sm)",
              background: "rgba(248, 81, 73, 0.1)",
              border: "1px solid var(--color-sell)",
              color: "var(--color-sell)",
              fontSize: "0.78rem",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem"
            }}>
              <AlertCircle size={12} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input footer */}
        <div style={{
          padding: "1rem 1.25rem",
          borderTop: "1px solid var(--color-border)",
          background: "rgba(255, 255, 255, 0.01)",
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem"
        }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            <button
              onClick={clearChat}
              disabled={messages.length === 0 || loading}
              className="btn-ghost"
              style={{
                padding: "0.5rem",
                borderRadius: "var(--radius-sm)",
                borderColor: "var(--color-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "38px",
                width: "38px"
              }}
              title="Limpiar chat"
            >
              <Trash2 size={14} style={{ color: messages.length === 0 ? "var(--color-text-muted)" : "var(--color-sell)" }} />
            </button>

            <div style={{ flex: 1, position: "relative" }}>
              <style>{`
                .copilot-textarea::placeholder {
                  color: #8b949e !important;
                  opacity: 0.85;
                }
                .copilot-textarea:focus {
                  border-color: var(--color-accent, #ffd43b) !important;
                  box-shadow: 0 0 0 2px rgba(255, 212, 59, 0.15);
                }
              `}</style>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ej: ¿Cuáles son las fortalezas técnicas de SPY?"
                disabled={loading}
                rows={1}
                className="copilot-textarea"
                style={{
                  width: "100%",
                  padding: "0.6rem 1rem",
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--color-text)",
                  fontSize: "0.85rem",
                  resize: "none",
                  fontFamily: "inherit",
                  lineHeight: 1.35,
                  outline: "none",
                  minHeight: "38px",
                  overflowY: "auto"
                }}
              />
            </div>

            <button
              className="btn-primary"
              onClick={() => void handleSend()}
              disabled={loading || !input.trim()}
              style={{
                padding: "0 1rem",
                height: "38px",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                borderRadius: "var(--radius-sm)",
                fontWeight: 700,
                fontSize: "0.8rem"
              }}
            >
              <span>{loading ? "..." : "Enviar"}</span>
              <Send size={12} />
            </button>
          </div>

          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.62rem",
            color: "var(--color-text-muted)",
            padding: "0 0.15rem"
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
              <CheckCircle size={8} color="var(--color-buy)" />
              <span>Gemini API activa (Auditoría Local).</span>
            </span>
          </div>
        </div>

      </div>
    </>
  );
}

export default GlobalChatDrawer;
