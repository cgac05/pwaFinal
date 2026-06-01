import type { NewsImpactResponse } from "./types";

export interface NewsTechnicalCorrelation {
  symbol: string;
  alignment: "aligned" | "mixed" | "conflict";
  message: string;
  score: number;
}

export function correlateNewsWithTechnical(news: NewsImpactResponse, technicalBias: "BUY" | "HOLD" | "SELL" = "HOLD"): NewsTechnicalCorrelation {
  const aligned = news.verdict === technicalBias || technicalBias === "HOLD" || news.verdict === "HOLD";
  const conflict = !aligned && news.verdict !== technicalBias;

  return {
    symbol: news.symbol,
    alignment: conflict ? "conflict" : aligned && news.verdict !== "HOLD" ? "aligned" : "mixed",
    message: conflict
      ? `Noticias ${news.verdict} chocan con lectura técnica ${technicalBias}.`
      : `Noticias ${news.verdict} son compatibles con lectura técnica ${technicalBias}.`,
    score: news.score
  };
}
