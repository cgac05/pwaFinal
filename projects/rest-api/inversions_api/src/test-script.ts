import "./config/envBootstrap";
import { buildStrategyFromChain } from "./routes/strategies/complex/strategyFromChainHandler";

async function run() {
  try {
    const result = await buildStrategyFromChain("iron_condor", {
      ticker: "SPY",
      expiracion: "2026-05-26",
      strikes: [
        { strike: 540, tipo: "put", posicion: "long" },
        { strike: 560, tipo: "put", posicion: "short" },
        { strike: 600, tipo: "call", posicion: "short" },
        { strike: 620, tipo: "call", posicion: "long" },
      ],
      contratos: 1,
      portfolio: {
        valor_portafolio_usd: 50000,
        poder_compra_usd: 25000,
        margen_actual_usd: 0,
        posiciones_actuales: 0,
      },
    });

    console.log("SUCCESS!");
    console.log("premiums_used:", JSON.stringify(result.premiums_used, null, 2));
  } catch (err) {
    console.error("ERROR:", err);
  }
}

run();
