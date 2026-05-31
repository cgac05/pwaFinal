/**
 * termStrategyContract.ts — T162 (modulo fundacional)
 * Proposito: Define los tipos base (TermLeg, TermStrategyInput) y la validacion
 * de consistencia temporal y estilo de opcion para Calendar/Diagonal Spreads.
 * Llamado por: calendarSpreadEngine, diagonalSpreadEngine, termSimulationEngine,
 *              termRiskEngine, termRollOrchestrator,
 *              routes/strategies/term/calendarSpread (POST /calendar),
 *              routes/strategies/term/diagonalSpread (POST /diagonal),
 *              routes/strategies/term/termComparator (POST /compare),
 *              tests unitarios y de integracion
 * Dependencias: Ninguna (modulo raiz del arbol de dependencias)
 */
import { buildCanonicalOutputString } from "@inversions/utils";

/** 'call' | 'put' — tipo de opcion */
export type OptionStyle = 'call' | 'put';

/** 'calendar' | 'diagonal' — tipo de estrategia temporal */
export type StrategyType = 'calendar' | 'diagonal';

/** Una pata individual de la estrategia: strike, fecha de expiracion, prima, contratos, estilo */
export interface TermLeg {
  strike: number;
  expiration: Date;
  premium: number;
  contracts: number;
  optionStyle: OptionStyle;
}

/** Input del contrato: array de legs + subyacente opcional */
export interface TermStrategyInput {
  legs: TermLeg[];
  underlying?: string;
}

/** Resultado de validacion: valido/invalido + lista de errores */
export interface ValidationResult {
  isValid: boolean;
  errors: TermStrategyError[];
}

/** Error de dominio con codigo, mensaje y campo afectado. Metodos estaticos para cada tipo de error */
export class TermStrategyError {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly field?: string
  ) {}

  /** Crea error: la expiracion corta debe ser anterior a la larga, o diferencia < 7 dias */
  static temporalInconsistency(field: string, detail: string): TermStrategyError {
    return new TermStrategyError('TEMPORAL_INCONSISTENCY', detail, field);
  }

  /** Crea error: optionStyle no es 'call' ni 'put' */
  static invalidOptionStyle(value: string): TermStrategyError {
    return new TermStrategyError('INVALID_OPTION_STYLE', `Invalid option style: '${value}'. Must be 'call' or 'put'.`, 'optionStyle');
  }

  /** Crea error: menos de 2 legs */
  static insufficientLegs(count: number): TermStrategyError {
    return new TermStrategyError('INSUFFICIENT_LEGS', `Expected at least 2 legs, got ${count}.`, 'legs');
  }

  /** Crea error: subyacentes diferentes entre legs */
  static inconsistentUnderlying(): TermStrategyError {
    return new TermStrategyError('INCONSISTENT_UNDERLYING', 'All legs must share the same underlying asset.', 'underlying');
  }

  /** Crea error: configuracion invalida generica (strikes, primas, contratos, etc.) */
  static invalidConfiguration(detail: string): TermStrategyError {
    return new TermStrategyError('INVALID_CONFIGURATION', detail);
  }

  /** Crea error: fecha invalida (Invalid Date) */
  static invalidDateFormat(field: string, detail: string): TermStrategyError {
    return new TermStrategyError('INVALID_DATE_FORMAT', detail, field);
  }

  /** Crea error: fecha de expiracion en pasado */
  static expirationInPast(field: string, detail: string): TermStrategyError {
    return new TermStrategyError('EXPIRATION_IN_PAST', detail, field);
  }
}

/** Contrato base que recibe input, valida y clasifica Calendar vs Diagonal. Instanciado por routes y engines */
export class TermStrategyContract {
  private readonly input: TermStrategyInput;

  constructor(input: TermStrategyInput) {
    this.input = input;
  }

  /** Valida el contrato completo: legs, consistencia temporal y estilo de opcion. Retorna ValidationResult */
  validate(): ValidationResult {
    const errors: TermStrategyError[] = [];

    const legErrors = this.validateLegs();
    errors.push(...legErrors);

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    const temporalErrors = this.validateTemporalConsistency();
    errors.push(...temporalErrors);

    const styleErrors = this.validateOptionStyleConsistency();
    errors.push(...styleErrors);

    return { isValid: errors.length === 0, errors };
  }

  /** Valida cada leg individual: strike positivo, prima no negativa, contratos > 0, optionStyle valido, fecha valida y no pasada. Ademas verifica mismo estilo entre legs */
  private validateLegs(): TermStrategyError[] {
    const errors: TermStrategyError[] = [];

    if (!this.input.legs || this.input.legs.length < 2) {
      errors.push(TermStrategyError.insufficientLegs(this.input.legs?.length ?? 0));
      return errors;
    }

    for (let i = 0; i < this.input.legs.length; i++) {
      const leg = this.input.legs[i];
      if (leg.strike <= 0) {
        errors.push(TermStrategyError.invalidConfiguration(`Leg ${i}: strike must be positive.`));
      }
      if (leg.premium < 0) {
        errors.push(TermStrategyError.invalidConfiguration(`Leg ${i}: premium cannot be negative.`));
      }
      if (leg.contracts <= 0) {
        errors.push(TermStrategyError.invalidConfiguration(`Leg ${i}: contracts must be positive.`));
      }
      if (leg.optionStyle !== 'call' && leg.optionStyle !== 'put') {
        errors.push(TermStrategyError.invalidOptionStyle(String(leg.optionStyle)));
      }
      const expTime = leg.expiration.getTime();
      if (isNaN(expTime)) {
        errors.push(TermStrategyError.invalidDateFormat(`Leg ${i}.expiration`, `Leg ${i}: expiration date is invalid.`));
      } else {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        if (expTime < oneDayAgo) {
          errors.push(TermStrategyError.expirationInPast(`Leg ${i}.expiration`, `Leg ${i}: expiration date is in the past.`));
        }
      }
    }

    const callOrPut = this.input.legs[0].optionStyle;
    const allSameStyle = this.input.legs.every(l => l.optionStyle === callOrPut);
    if (!allSameStyle) {
      errors.push(TermStrategyError.invalidConfiguration('All legs must have the same option style (all calls or all puts).'));
    }

    return errors;
  }

  /** Valida que expiracion corta < expiracion larga y diferencia >= 7 dias */
  private validateTemporalConsistency(): TermStrategyError[] {
    const errors: TermStrategyError[] = [];
    const minExpirationDiffDays = 7;

    const sortedByExpiration = [...this.input.legs].sort(
      (a, b) => a.expiration.getTime() - b.expiration.getTime()
    );

    const shortExp = sortedByExpiration[0].expiration;
    const longExp = sortedByExpiration[sortedByExpiration.length - 1].expiration;

    if (shortExp.getTime() >= longExp.getTime()) {
      errors.push(
        TermStrategyError.temporalInconsistency(
          'expiration',
          'Short expiration must be before long expiration.'
        )
      );
    }

    const diffMs = longExp.getTime() - shortExp.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < minExpirationDiffDays) {
      errors.push(
        TermStrategyError.temporalInconsistency(
          'expiration',
          `Minimum expiration difference is ${minExpirationDiffDays} days, got ${Math.round(diffDays)}.`
        )
      );
    }

    return errors;
  }

  /** Clasifica Calendar (mismo strike) vs Diagonal (strikes diferentes). Rechaza misma expiracion+strike (no es spread) o mismo strike+misma expiracion (vertical spread) */
  private validateOptionStyleConsistency(): TermStrategyError[] {
    const errors: TermStrategyError[] = [];

    const strikes = this.input.legs.map(l => l.strike);
    const uniqueStrikes = new Set(strikes);
    const expirations = this.input.legs.map(l => l.expiration.getTime());
    const uniqueExpirations = new Set(expirations);

    const allSameStrike = uniqueStrikes.size === 1;
    const allSameExpiration = uniqueExpirations.size === 1;

    if (allSameStrike && !allSameExpiration) {
      return errors;
    }

    if (!allSameStrike && !allSameExpiration) {
      return errors;
    }

    if (allSameStrike && allSameExpiration) {
      errors.push(
        TermStrategyError.invalidConfiguration(
          'Both legs have the same strike and expiration. This is not a valid Calendar or Diagonal spread.'
        )
      );
    }

    if (!allSameStrike && allSameExpiration) {
      errors.push(
        TermStrategyError.invalidConfiguration(
          'Different strikes with same expiration is not a Calendar or Diagonal spread (this is a vertical spread).'
        )
      );
    }

    return errors;
  }

  /** Retorna 'calendar' si todos los strikes son iguales, 'diagonal' si son diferentes. Usado por routes para validar el endpoint correcto */
  getType(): StrategyType {
    const strikes = this.input.legs.map(l => l.strike);
    const uniqueStrikes = new Set(strikes);

    if (uniqueStrikes.size === 1) {
      return 'calendar';
    }
    return 'diagonal';
  }

  /** Retorna copia defensiva de los legs. Usado por engines para leer los datos del contrato */
  getLegs(): TermLeg[] {
    return [...this.input.legs];
  }

  /** Retorna copia defensiva del input completo. Mantiene inmutabilidad del contrato original */
  getInput(): TermStrategyInput {
    return { ...this.input, legs: [...this.input.legs] };
  }

  /** Genera señal del tipo de estrategia (calendar/diagonal) — formato canónico */
  signal(): string {
    const type = this.getType();
    return buildCanonicalOutputString({
      core: "E_ESTRATEGIA",
      subCore: "term_strategy",
      tipoSenal: "HOLD",
      score: 0,
      peso: 1,
      observacion: {
        objetivo: `Identificar tipo de estrategia: ${type}`,
        senal: type.toUpperCase(),
        explicacion: `Estrategia temporal de tipo ${type} spread`,
        metricas: {},
      },
    });
  }
}
