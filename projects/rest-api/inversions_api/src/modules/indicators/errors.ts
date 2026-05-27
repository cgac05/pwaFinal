// FIC: Uniform error helper for indicators endpoints (Spanish messages, structured body).
// FIC: Helper uniforme de errores para endpoints de indicadores (mensajes en español, cuerpo estructurado).

import type { Response } from "express";
import type { IndicatorError } from "./types";

export function respondError(
  res: Response,
  status: number,
  code: string,
  message: string,
  hint?: string
): Response {
  const body: IndicatorError = { error_code: code, message, hint };
  return res.status(status).json(body);
}
