import * as dotenv from 'dotenv';
dotenv.config();

import { runAiCore } from '../src/modules/simulation/aiCoreRunner';

async function test() {
  console.log("Iniciando test de IA Core...");
  console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "CONFIGURADA" : "NO CONFIGURADA");
  
  const result = await runAiCore({
    ticket: "SPY",
    timeframe: "1h",
    sourceInputHash: "test_hash_123",
    computedAt: new Date(),
    precalculatedRows: []
  });
  
  console.log("Resultado del Core IA:", result.estado);
  console.log("Explicación:", result.observacion.explicacion);
  console.log("Veredicto:", result.tipoSenal);
}

test().catch(console.error);
