import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPaneApi,
} from "lightweight-charts";
import type { LegendData } from "./ChartLegend";
import type { OHLCVData } from "../../utils/indicators";

export interface ActiveIndicators {
  rsi: boolean;
  macd: boolean;
  bb: boolean;
}

const STRETCH_MAIN = 5;
const STRETCH_VOLUME = 1;
const STRETCH_RSI = 0.8;
const STRETCH_MACD = 1;
const STRETCH_HIDDEN = 0.001;

function getCSSVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getChartTheme() {
  return {
    bg: getCSSVar("--color-bg") || "#000000",
    text: getCSSVar("--color-text") || "#ffffff",
    border: getCSSVar("--color-border") || "rgba(255,255,255,0.12)",
    fontFamily: getCSSVar("--font-family") || "Inter, sans-serif",
    buy: getCSSVar("--color-buy") || "#00a87e",
    sell: getCSSVar("--color-sell") || "#e23b4a",
  };
}

export function useChartInit(
  containerRef: React.RefObject<HTMLDivElement>,
  symbol: string | undefined,
  timeframe: string,
  activeIndicators: ActiveIndicators,
) {
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<any> | null>(null);
  const rsiPaneRef = useRef<IPaneApi<any> | null>(null);
  const macdLineRef = useRef<ISeriesApi<any> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<any> | null>(null);
  const macdHistRef = useRef<ISeriesApi<any> | null>(null);
  const macdPaneRef = useRef<IPaneApi<any> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<any> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<any> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<any> | null>(null);

  // Written by SuperChart after each data load; read by the crosshair handler
  const candlesDataRef = useRef<OHLCVData[]>([]);

  // Keep timeframe current inside the long-lived crosshair closure
  const timeframeRef = useRef(timeframe);
  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  const [legendData, setLegendData] = useState<LegendData | null>(null);

  // Snapshot of activeIndicators for the init effect (avoids it as a dep that re-creates the chart)
  const activeIndicatorsRef = useRef(activeIndicators);
  useEffect(() => {
    activeIndicatorsRef.current = activeIndicators;
  });

  // ── Chart initialization ────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !symbol) return;

    const theme = getChartTheme();

    const chart = createChart(containerRef.current, {
      layout: {
        textColor: theme.text,
        background: { type: ColorType.Solid, color: theme.bg },
        fontFamily: theme.fontFamily,
      },
      grid: {
        vertLines: { color: theme.border },
        horzLines: { color: theme.border },
      },
      width: containerRef.current.clientWidth,
      height: Math.max(containerRef.current.clientHeight, 340),
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: theme.border,
      },
      rightPriceScale: { borderColor: theme.border },
    });

    chartRef.current = chart;

    // Pane 0 — candlesticks + Bollinger Bands
    chart.panes()[0].setStretchFactor(STRETCH_MAIN);

    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: theme.buy,
        downColor: theme.sell,
        borderVisible: true,
        wickUpColor: theme.buy,
        wickDownColor: theme.sell,
      },
      0,
    );
    candleSeriesRef.current = candleSeries;

    const bbOpts = {
      lineWidth: 1 as const,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    };
    const bbUpper = chart.addSeries(LineSeries, { ...bbOpts, color: "#b2b5be" }, 0);
    const bbMiddle = chart.addSeries(LineSeries, { ...bbOpts, color: "#f5c518" }, 0);
    const bbLower = chart.addSeries(LineSeries, { ...bbOpts, color: "#b2b5be" }, 0);
    bbUpperRef.current = bbUpper;
    bbMiddleRef.current = bbMiddle;
    bbLowerRef.current = bbLower;

    // Pane 1 — volume
    const volumePane = chart.addPane();
    volumePane.setStretchFactor(STRETCH_VOLUME);
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      },
      1,
    );
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    // Pane 2 — RSI
    const rsiPane = chart.addPane();
    rsiPane.setStretchFactor(STRETCH_RSI);
    rsiPaneRef.current = rsiPane;
    const rsiSeries = chart.addSeries(
      LineSeries,
      {
        color: "#7b61ff",
        lineWidth: 2 as const,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      },
      2,
    );
    rsiSeries.createPriceLine({
      price: 70,
      color: "#ef5350",
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: false,
    });
    rsiSeries.createPriceLine({
      price: 30,
      color: "#26a69a",
      lineStyle: LineStyle.Dashed,
      lineWidth: 1,
      axisLabelVisible: false,
    });
    rsiSeriesRef.current = rsiSeries;

    // Pane 3 — MACD
    const macdPane = chart.addPane();
    macdPane.setStretchFactor(STRETCH_MACD);
    macdPaneRef.current = macdPane;

    const macdLine = chart.addSeries(
      LineSeries,
      {
        color: "#2196f3",
        lineWidth: 2 as const,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      },
      3,
    );
    const macdSignal = chart.addSeries(
      LineSeries,
      {
        color: "#ff9800",
        lineWidth: 2 as const,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      },
      3,
    );
    const macdHist = chart.addSeries(
      HistogramSeries,
      { lastValueVisible: false, priceLineVisible: false },
      3,
    );
    macdLineRef.current = macdLine;
    macdSignalRef.current = macdSignal;
    macdHistRef.current = macdHist;

    // Apply initial indicator visibility (snapshot at chart creation)
    const initActive = activeIndicatorsRef.current;
    [bbUpper, bbMiddle, bbLower].forEach(s =>
      s.applyOptions({ visible: initActive.bb }),
    );
    rsiSeries.applyOptions({ visible: initActive.rsi });
    rsiPane.setStretchFactor(initActive.rsi ? STRETCH_RSI : STRETCH_HIDDEN);
    [macdLine, macdSignal, macdHist].forEach(s =>
      s.applyOptions({ visible: initActive.macd }),
    );
    macdPane.setStretchFactor(initActive.macd ? STRETCH_MACD : STRETCH_HIDDEN);

    // Crosshair → legend
    chart.subscribeCrosshairMove(param => {
      const candles = candlesDataRef.current;
      if (!candles.length) return;

      if (!param.time) {
        const last = candles[candles.length - 1];
        const prev = candles.length > 1 ? candles[candles.length - 2] : null;
        setLegendData({
          symbol,
          timeframe: timeframeRef.current,
          open: last.open,
          high: last.high,
          low: last.low,
          close: last.close,
          volume: last.volume ?? 0,
          prevClose: prev?.close ?? null,
        });
        return;
      }

      const bar = param.seriesData.get(candleSeries) as any;
      if (!bar) return;

      const t = param.time as number;
      const idx = candles.findIndex(c => Number(c.time) === t);
      const volData = param.seriesData.get(volumeSeries) as any;
      const rsiData = param.seriesData.get(rsiSeries) as any;

      setLegendData({
        symbol,
        timeframe: timeframeRef.current,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: volData?.value ?? (idx >= 0 ? (candles[idx].volume ?? 0) : 0),
        prevClose: idx > 0 ? candles[idx - 1].close : null,
        rsiValue: rsiData?.value,
      });
    });

    // Theme change
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onThemeChange = () => {
      if (!chartRef.current) return;
      const t = getChartTheme();
      chartRef.current.applyOptions({
        layout: { textColor: t.text, background: { type: ColorType.Solid, color: t.bg } },
        grid: { vertLines: { color: t.border }, horzLines: { color: t.border } },
        timeScale: { borderColor: t.border },
        rightPriceScale: { borderColor: t.border },
      });
      candleSeriesRef.current?.applyOptions({
        upColor: t.buy, downColor: t.sell,
        wickUpColor: t.buy, wickDownColor: t.sell,
      });
    };
    mq.addEventListener("change", onThemeChange);

    // Resize
    const ro = new ResizeObserver(entries => {
      if (!chartRef.current) return;
      for (const e of entries) {
        const { width } = e.contentRect;
        if (width > 0) {
          chartRef.current.applyOptions({ width });
          chartRef.current.timeScale().fitContent();
        }
      }
    });
    ro.observe(containerRef.current);

    return () => {
      mq.removeEventListener("change", onThemeChange);
      ro.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      rsiSeriesRef.current = null;
      rsiPaneRef.current = null;
      macdLineRef.current = null;
      macdSignalRef.current = null;
      macdHistRef.current = null;
      macdPaneRef.current = null;
      bbUpperRef.current = null;
      bbMiddleRef.current = null;
      bbLowerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // ── Indicator toggle ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;

    [bbUpperRef, bbMiddleRef, bbLowerRef].forEach(r =>
      r.current?.applyOptions({ visible: activeIndicators.bb }),
    );

    rsiSeriesRef.current?.applyOptions({ visible: activeIndicators.rsi });
    rsiPaneRef.current?.setStretchFactor(
      activeIndicators.rsi ? STRETCH_RSI : STRETCH_HIDDEN,
    );

    [macdLineRef, macdSignalRef, macdHistRef].forEach(r =>
      r.current?.applyOptions({ visible: activeIndicators.macd }),
    );
    macdPaneRef.current?.setStretchFactor(
      activeIndicators.macd ? STRETCH_MACD : STRETCH_HIDDEN,
    );
  }, [activeIndicators]);

  return {
    chartRef,
    candleSeriesRef,
    volumeSeriesRef,
    rsiSeriesRef,
    macdLineRef,
    macdSignalRef,
    macdHistRef,
    bbUpperRef,
    bbMiddleRef,
    bbLowerRef,
    candlesDataRef,
    legendData,
    setLegendData,
  };
}
