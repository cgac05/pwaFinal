/**
 * calendarSpreadEngine.ts — T163
 * Proposito: Motor de analisis de Calendar Spread (mismo strike, expiraciones diferentes).
 * Calcula theta decay, escenarios de precio y perfil de riesgo para variantes call/put.
 * Llamado por: termSimulationEngine (simula escenarios con CalendarSpreadEngine),
 *              routes/strategies/term/calendarSpread (POST /calendar),
 *              routes/strategies/term/termComparator (POST /compare)
 * Dependencias: termStrategyContract (tipos y validacion), termUtils (Black-Scholes)
 */
import { buildCanonicalOutputString } from "@inversions/utils";
import { TermStrategyContract, type OptionStyle, type TermLeg } from "./termStrategyContract";
import {
  blackScholesPrice,
  blackScholesDelta,
  blackScholesGamma,
  blackScholesTheta,
  blackScholesVega,
  interpolateIv,
  daysToExpiration,
} from "./termUtils";

export interface GreekSensitivities {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface CalendarScenario {
  underlyingPrice: number;
  strategyValue: number;
  pnl: number;
  theta: number;
  impliedVolatility: number;
}

export interface CalendarStressTest {
  label: string;
  description: string;
  underlyingPrice: number;
  shortIv: number;
  longIv: number;
  strategyValue: number;
  pnl: number;
  theta: number;
}

export interface CalendarSpreadResult {
  shortDte: number;
  longDte: number;
  shortTheta: number;
  longTheta: number;
  netTheta: number;
  greeks: GreekSensitivities;
  scenarios: CalendarScenario[];
  stressTests: CalendarStressTest[];
}

export interface IvCurvePoint {
  dte: number;
  iv: number;
}

export class CalendarSpreadEngine {
  private readonly contract: TermStrategyContract;
  private readonly riskFreeRate: number;
  private readonly ivCurve: IvCurvePoint[];

  /** Construye el engine con un contrato validado, tasa libre de riesgo (default 5%) y curva IV opcional */
  constructor(
    contract: TermStrategyContract,
    riskFreeRate: number = 0.05,
    ivCurve: IvCurvePoint[] = []
  ) {
    this.contract = contract;
    this.riskFreeRate = riskFreeRate;
    this.ivCurve = ivCurve;
  }

  /** Analiza el Calendar Spread: ordena legs por expiracion, calcula DTE, thetas (corta/larga/neto) y genera escenarios de precio. Llamado por calendarSpread.ts ruta POST /calendar */
  analyze(): CalendarSpreadResult {
    const legs = this.contract.getLegs();
    const now = new Date();

    const sortedByExpiration = [...legs].sort(
      (a, b) => a.expiration.getTime() - b.expiration.getTime()
    );

    const shortLeg = sortedByExpiration[0];
    const longLeg = sortedByExpiration[sortedByExpiration.length - 1];

    const shortDte = daysToExpiration(shortLeg.expiration, now);
    const longDte = daysToExpiration(longLeg.expiration, now);

    const shortIv = interpolateIv(shortDte, this.ivCurve);
    const longIv = interpolateIv(longDte, this.ivCurve);

    const shortT = shortDte / 365;
    const longT = longDte / 365;

    const shortTheta = blackScholesTheta(
      shortLeg.strike, shortLeg.strike, shortT, this.riskFreeRate, shortIv, shortLeg.optionStyle
    ) * shortLeg.contracts;
    const longTheta = blackScholesTheta(
      longLeg.strike, longLeg.strike, longT, this.riskFreeRate, longIv, longLeg.optionStyle
    ) * longLeg.contracts;

    const netTheta = longTheta - shortTheta;

    const shortDelta = blackScholesDelta(shortLeg.strike, shortLeg.strike, shortT, this.riskFreeRate, shortIv, shortLeg.optionStyle) * shortLeg.contracts;
    const longDelta = blackScholesDelta(longLeg.strike, longLeg.strike, longT, this.riskFreeRate, longIv, longLeg.optionStyle) * longLeg.contracts;
    const netDelta = longDelta - shortDelta;

    const shortGamma = blackScholesGamma(shortLeg.strike, shortLeg.strike, shortT, this.riskFreeRate, shortIv, shortLeg.optionStyle) * shortLeg.contracts;
    const longGamma = blackScholesGamma(longLeg.strike, longLeg.strike, longT, this.riskFreeRate, longIv, longLeg.optionStyle) * longLeg.contracts;
    const netGamma = longGamma - shortGamma;

    const shortVega = blackScholesVega(shortLeg.strike, shortLeg.strike, shortT, this.riskFreeRate, shortIv, shortLeg.optionStyle) * shortLeg.contracts;
    const longVega = blackScholesVega(longLeg.strike, longLeg.strike, longT, this.riskFreeRate, longIv, longLeg.optionStyle) * longLeg.contracts;
    const netVega = longVega - shortVega;

    const optionStyle = shortLeg.optionStyle;

    const scenarios = this.generateScenarios(shortLeg, longLeg, shortDte, longDte, optionStyle);
    const stressTests = this.generateStressTests(shortLeg, longLeg, shortDte, longDte, optionStyle, shortIv, longIv);

    return {
      shortDte,
      longDte,
      shortTheta,
      longTheta,
      netTheta,
      greeks: {
        delta: Math.round(netDelta * 1000) / 1000,
        gamma: Math.round(netGamma * 1000) / 1000,
        theta: Math.round(netTheta * 100) / 100,
        vega: Math.round(netVega * 100) / 100,
      },
      scenarios,
      stressTests,
    };
  }

  /** Genera escenarios de precio en rango [70%-130%] del strike, calculando valor estrategia, P&L, theta e IV para cada punto */
  private generateScenarios(
    shortLeg: TermLeg,
    longLeg: TermLeg,
    shortDte: number,
    longDte: number,
    optionStyle: OptionStyle
  ): CalendarScenario[] {
    const scenarios: CalendarScenario[] = [];
    const atmStrike = shortLeg.strike;
    const priceMin = atmStrike * 0.7;
    const priceMax = atmStrike * 1.3;
    const step = atmStrike * 0.02;

    const shortT = shortDte / 365;
    const longT = longDte / 365;
    const entryCost = this.calculateNetEntryCost(shortLeg, longLeg);

    for (let price = priceMin; price <= priceMax; price += step) {
      const shortIv = interpolateIv(shortDte, this.ivCurve);
      const longIv = interpolateIv(longDte, this.ivCurve);

      const shortPrice = blackScholesPrice(
        price, shortLeg.strike, shortT, this.riskFreeRate, shortIv, optionStyle
      );
      const longPrice = blackScholesPrice(
        price, longLeg.strike, longT, this.riskFreeRate, longIv, optionStyle
      );

      const strategyValue = this.calculatePositionValue(shortLeg, longLeg, shortPrice, longPrice);
      const pnl = strategyValue - entryCost;

      const theta = blackScholesTheta(
        price, longLeg.strike, longT, this.riskFreeRate, longIv, optionStyle
      ) * longLeg.contracts - blackScholesTheta(
        price, shortLeg.strike, shortT, this.riskFreeRate, shortIv, optionStyle
      ) * shortLeg.contracts;

      scenarios.push({
        underlyingPrice: Math.round(price * 100) / 100,
        strategyValue: Math.round(strategyValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        theta: Math.round(theta * 100) / 100,
        impliedVolatility: Math.round(longIv * 100) / 100,
      });
    }

    return scenarios;
  }

  /** Genera escenarios de stress: crash, gap up, IV expansion, IV contraction, volatility spike.
   *  Evalua el impacto extremo en el valor de la estrategia y P&L. */
  private generateStressTests(
    shortLeg: TermLeg,
    longLeg: TermLeg,
    shortDte: number,
    longDte: number,
    optionStyle: OptionStyle,
    baseShortIv: number,
    baseLongIv: number
  ): CalendarStressTest[] {
    const shortT = shortDte / 365;
    const longT = longDte / 365;
    const atm = shortLeg.strike;
    const entryCost = this.calculateNetEntryCost(shortLeg, longLeg);

    const tests: Array<{ label: string; description: string; price: number; shortIvMult: number; longIvMult: number }> = [
      { label: "Market Crash", description: "Underlying drops 20%, IV spikes +50%", price: atm * 0.8, shortIvMult: 1.5, longIvMult: 1.5 },
      { label: "Sharp Rally", description: "Underlying jumps 15%, IV drops 20%", price: atm * 1.15, shortIvMult: 0.8, longIvMult: 0.8 },
      { label: "IV Expansion", description: "IV expands +50% across all tenors", price: atm, shortIvMult: 1.5, longIvMult: 1.5 },
      { label: "IV Contraction", description: "IV contracts 30% across all tenors", price: atm, shortIvMult: 0.7, longIvMult: 0.7 },
      { label: "Volatility Spike", description: "Short IV spikes +80%, long IV +30%", price: atm, shortIvMult: 1.8, longIvMult: 1.3 },
    ];

    return tests.map(t => {
      const shortIv = baseShortIv * t.shortIvMult;
      const longIv = baseLongIv * t.longIvMult;
      const shortP = blackScholesPrice(t.price, shortLeg.strike, shortT, this.riskFreeRate, shortIv, optionStyle);
      const longP = blackScholesPrice(t.price, longLeg.strike, longT, this.riskFreeRate, longIv, optionStyle);
      const strategyValue = this.calculatePositionValue(shortLeg, longLeg, shortP, longP);
      const pnl = strategyValue - entryCost;
      const theta = blackScholesTheta(t.price, longLeg.strike, longT, this.riskFreeRate, longIv, optionStyle)
        * longLeg.contracts - blackScholesTheta(t.price, shortLeg.strike, shortT, this.riskFreeRate, shortIv, optionStyle)
        * shortLeg.contracts;

      return {
        label: t.label,
        description: t.description,
        underlyingPrice: Math.round(t.price * 100) / 100,
        shortIv: Math.round(shortIv * 100) / 100,
        longIv: Math.round(longIv * 100) / 100,
        strategyValue: Math.round(strategyValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        theta: Math.round(theta * 100) / 100,
      };
    });
  }

  private calculatePositionValue(
    shortLeg: TermLeg,
    longLeg: TermLeg,
    shortPrice: number,
    longPrice: number
  ): number {
    return longPrice * longLeg.contracts - shortPrice * shortLeg.contracts;
  }

  private calculateNetEntryCost(shortLeg: TermLeg, longLeg: TermLeg): number {
    return longLeg.premium * longLeg.contracts - shortLeg.premium * shortLeg.contracts;
  }

  /** Retorna el contrato original. Usado por termSimulationEngine para leer legs durante simulacion */
  getContract(): TermStrategyContract {
    return this.contract;
  }

  /** Genera señal de trading basada en el análisis del Calendar Spread — formato canónico */
  signal(): string {
    const result = this.analyze();
    let tipoSenal: "CALL" | "PUT" | "HOLD";
    let score: number;
    let objetivo: string;
    let senal: string;

    if (result.shortDte <= 0) {
      tipoSenal = "HOLD";
      score = 0;
      objetivo = "Calendar Spread expirado — sin acción posible";
      senal = "EXPIRED";
    } else if (result.shortDte <= 7) {
      tipoSenal = "CALL";
      score = 0.6;
      objetivo = "Calendar Spread próximo a expirar — evaluar roll";
      senal = "ROLL";
    } else if (result.greeks.theta < -5) {
      tipoSenal = "HOLD";
      score = 0.3;
      objetivo = "Calendar Spread con theta negativo elevado — monitorear";
      senal = "THETA_ALERT";
    } else if (Math.abs(result.greeks.delta) > 0.7) {
      tipoSenal = result.greeks.delta > 0 ? "CALL" : "PUT";
      score = Math.abs(result.greeks.delta);
      objetivo = "Calendar Spread con delta extremo — evaluar ajuste";
      senal = "DELTA_ALERT";
    } else {
      tipoSenal = "HOLD";
      score = 0.1;
      objetivo = "Calendar Spread dentro de parámetros normales";
      senal = "HOLD";
    }

    return buildCanonicalOutputString({
      core: "E_ESTRATEGIA",
      subCore: "calendar_spread",
      tipoSenal,
      score,
      peso: 1,
      observacion: {
        objetivo,
        senal,
        explicacion: `Calendar Spread: shortDte=${result.shortDte}, longDte=${result.longDte}, netTheta=${result.netTheta.toFixed(3)}, delta=${result.greeks.delta.toFixed(3)}, gamma=${result.greeks.gamma.toFixed(3)}, theta=${result.greeks.theta.toFixed(3)}`,
        metricas: {
          shortDte: result.shortDte,
          longDte: result.longDte,
          netTheta: result.netTheta,
          delta: result.greeks.delta,
          gamma: result.greeks.gamma,
          theta: result.greeks.theta,
          vega: result.greeks.vega,
        },
      },
    });
  }
}
