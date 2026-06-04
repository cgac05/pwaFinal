/**
 * FIC: English/Español
 * Service for fetching real-time market data from the Finnhub API.
 * Servicio para obtener datos de mercado en tiempo real de la API de Finnhub.
 */

import dotenv from "dotenv";
dotenv.config();

// FIC: Finnhub API key provided by the user
// Clave API de Finnhub proporcionada por el usuario
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || "d7imqapr01qn2qauldegd7imqapr01qn2qauldf0";

export interface FinnhubQuote {
  currentPrice: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

/**
 * FIC: Fetches real-time price data for a given ticker symbol.
 * Obtiene datos de precios en tiempo real para un símbolo de ticker dado.
 */
export async function getStockQuote(symbol: string): Promise<FinnhubQuote | null> {
  // FIC: Clean ticker symbol (e.g. remove spaces, convert to uppercase)
  // Limpiar el símbolo del ticker (ej. eliminar espacios, convertir a mayúsculas)
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${cleanSymbol}&token=${FINNHUB_API_KEY}`;
    
    // FIC: Use native fetch API (supported in Node 18+)
    // Usar la API fetch nativa (soportada en Node 18+)
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`FIC: Finnhub API request failed with status: ${response.status} / La solicitud de la API de Finnhub falló con estado: ${response.status}`);
      return null;
    }

    const data: any = await response.json();
    
    // FIC: Validate response format. Finnhub returns 'c: 0' for invalid tickers.
    // Validar el formato de la respuesta. Finnhub devuelve 'c: 0' para tickers inválidos.
    if (!data || typeof data.c === "undefined" || data.c === null || data.c === 0) {
      console.warn(`FIC: Finnhub returned no valid price data for symbol: ${cleanSymbol} / Finnhub no devolvió datos de precios válidos para el símbolo: ${cleanSymbol}`);
      return null;
    }

    return {
      currentPrice: Number(data.c),
      high: Number(data.h || 0),
      low: Number(data.l || 0),
      open: Number(data.o || 0),
      previousClose: Number(data.pc || 0),
      timestamp: Number(data.t || 0)
    };
  } catch (error: any) {
    console.error(`FIC: Error fetching stock quote from Finnhub: ${error.message} / Error al obtener la cotización de acciones de Finnhub: ${error.message}`);
    return null;
  }
}
