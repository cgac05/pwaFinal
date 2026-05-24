// El endpoint que el frontend (o Postman) consume

import { Router } from 'express';
import { InvestmentAdvisor } from '../../modules/news/investmentAdvisor';

const router = Router();

/**
 * GET /news/sentiment/:symbol
 * Ej: GET /news/sentiment/AAPL
 */
router.get('/:symbol', async (req, res) => {
    const { symbol } = req.params;

    if (!symbol || symbol.length > 10) {
        return res.status(400).json({ error: 'Símbolo inválido.' }); 5
    }

    try {
        const advisor = new InvestmentAdvisor(
            process.env.ALPACA_API_KEY!,
            process.env.ALPACA_API_SECRET!,
        );

        const verdict = await advisor.evaluate(symbol.toUpperCase());
        return res.json(verdict);

    } catch (err) {
        console.error('[NewsSentiment] Error:', err);
        return res.status(500).json({ error: 'Error al evaluar el sentimiento.' });
    }
});

export default router;