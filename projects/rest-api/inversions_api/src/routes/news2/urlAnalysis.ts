// src/routes/news/urlAnalysis.ts
// FIC: Endpoint para análisis de fuentes personalizadas (URLs) de noticias financieras

import { Router, Request, Response } from 'express';
import { URLAnalysisService } from '../../modules/news2/urlAnalysisService';

const router = Router();
const urlAnalysisService = new URLAnalysisService();

/**
 * POST /news2/analyze-sources
 * FIC: Analiza múltiples dominios de fuentes financieras para una compañía específica
 * El sistema automáticamente busca noticias de la compañía en esos dominios
 *
 * Body:
 * {
 *   "company": "Apple",
 *   "urls": ["bloomberg.com", "cnbc.com", "reuters.com"]
 * }
 *
 * Response:
 * {
 *   "url": "bloomberg.com, cnbc.com, reuters.com",
 *   "company": "Apple",
 *   "verdict": "BUY",
 *   "score": 0.65,
 *   "confidence": 0.8,
 *   "reasoning": "...",
 *   "keyPoints": [...],
 *   "timestamp": "2026-05-24T..."
 * }
 */
router.post('/analyze-sources', async (req: Request, res: Response) => {
  try {
    const { company, urls } = req.body;

    // FIC: Validación de entrada
    if (!company || typeof company !== 'string') {
      return res.status(400).json({
        error: 'Campo "company" requerido y debe ser string',
      });
    }

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        error: 'Campo "urls" requerido, debe ser array con al menos 1 dominio',
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        error: 'Máximo 10 dominios por análisis',
      });
    }

    const invalidUrls = urls.filter((url) => {
      if (typeof url !== 'string' || url.trim().length === 0) {
        return true;
      }

      try {
        new URL(url.startsWith('http') ? url : `https://${url}`);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      return res.status(400).json({
        error: `Dominios inválidos: ${invalidUrls.join(', ')}. Usa solo dominios (ej: bloomberg.com) o URLs (ej: https://bloomberg.com)`,
      });
    }

    // FIC: Ejecuta análisis
    const result = await urlAnalysisService.analyzeSourcesForCompany(
      company,
      urls
    );

    return res.json(result);
  } catch (error) {
    console.error('[NewsAnalysis] Error:', error);
    return res.status(500).json({
      error: `Error al analizar fuentes: ${(error as Error).message}`,
    });
  }
});

/**
 * GET /news2/validate-url
 * FIC: Valida que un dominio sea de una fuente financiera confiable
 *
 * Query:
 * ?url=bloomberg.com o ?url=https://bloomberg.com
 *
 * Response:
 * { "valid": true, "message": "Dominio válido" }
 */
router.get('/validate-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'Parámetro "url" requerido (dominio o URL)',
      });
    }

    const isValid = await urlAnalysisService.validateURL(url);

    return res.json({
      valid: isValid,
      message: isValid
        ? 'Dominio confiable y válido'
        : 'Dominio no confiable o inaccesible. Usa: bloomberg.com, cnbc.com, reuters.com, wsj.com, etc.',
    });
  } catch (error) {
    console.error('[ValidateURL] Error:', error);
    return res.status(500).json({
      error: `Error validando URL: ${(error as Error).message}`,
    });
  }
});

export default router;
