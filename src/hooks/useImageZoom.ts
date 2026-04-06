import { useState, useCallback, useRef, useEffect, useMemo } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 10;
const ZOOM_STEP = 1.25;
const WHEEL_ZOOM_SENSITIVITY = 0.005;
const DOUBLE_CLICK_ZOOM = 2.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function clampTranslation(
  tx: number,
  ty: number,
  scale: number,
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number
): { tx: number; ty: number } {
  if (scale <= 1) return { tx: 0, ty: 0 };

  const scaledW = imageW * scale;
  const scaledH = imageH * scale;
  const maxTx = Math.max(0, (scaledW - containerW) / 2);
  const maxTy = Math.max(0, (scaledH - containerH) / 2);

  return {
    tx: clamp(tx, -maxTx, maxTx),
    ty: clamp(ty, -maxTy, maxTy),
  };
}

export function useImageZoom(
  containerRef: React.RefObject<HTMLElement | null>,
  imageRef: React.RefObject<HTMLImageElement | null>
) {
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);

  const shouldTransitionRef = useRef(true);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const baseDimsRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  // Use refs for scale/translate so wheel handler doesn't go stale
  const scaleRef = useRef(scale);
  const txRef = useRef(translateX);
  const tyRef = useRef(translateY);
  scaleRef.current = scale;
  txRef.current = translateX;
  tyRef.current = translateY;

  const isZoomed = scale > 1.01;
  const zoomPercent = Math.round(scale * 100);

  const transformStyle = `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;

  const cursorStyle = isPanning ? "grabbing" : isZoomed ? "grab" : "default";

  const shouldTransition = shouldTransitionRef.current && !isPanning;

  const getContainerDims = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { w: 0, h: 0 };
    return { w: el.clientWidth, h: el.clientHeight };
  }, [containerRef]);

  const getImageBaseDims = useCallback(() => {
    return baseDimsRef.current;
  }, []);

  const applyZoom = useCallback(
    (newScale: number, newTx: number, newTy: number, transition: boolean) => {
      const clamped = clamp(newScale, MIN_SCALE, MAX_SCALE);
      const { w: cw, h: ch } = getContainerDims();
      const { w: iw, h: ih } = getImageBaseDims();
      const t = clampTranslation(newTx, newTy, clamped, cw, ch, iw, ih);
      shouldTransitionRef.current = transition;
      setScale(clamped);
      setTranslateX(t.tx);
      setTranslateY(t.ty);
    },
    [getContainerDims, getImageBaseDims]
  );

  const zoomIn = useCallback(() => {
    const s = scaleRef.current;
    applyZoom(s * ZOOM_STEP, txRef.current, tyRef.current, true);
  }, [applyZoom]);

  const zoomOut = useCallback(() => {
    const s = scaleRef.current;
    applyZoom(s / ZOOM_STEP, txRef.current, tyRef.current, true);
  }, [applyZoom]);

  const zoomToFit = useCallback(() => {
    applyZoom(1, 0, 0, true);
  }, [applyZoom]);

  const reset = useCallback(() => {
    shouldTransitionRef.current = false;
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
    setIsPanning(false);
    isPanningRef.current = false;
    panStartRef.current = null;
  }, []);

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    baseDimsRef.current = { w: img.offsetWidth, h: img.offsetHeight };
  }, [imageRef]);

  // Native wheel handler (non-passive for preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const s = scaleRef.current;

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom or Ctrl+scroll → zoom
        e.preventDefault();

        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left - rect.width / 2;
        const cursorY = e.clientY - rect.top - rect.height / 2;

        const tx = txRef.current;
        const ty = tyRef.current;

        const zoomFactor = 1 - e.deltaY * WHEEL_ZOOM_SENSITIVITY;
        const newScale = clamp(s * zoomFactor, MIN_SCALE, MAX_SCALE);
        const ratio = newScale / s;
        const newTx = cursorX - (cursorX - tx) * ratio;
        const newTy = cursorY - (cursorY - ty) * ratio;

        const { w: cw, h: ch } = {
          w: el.clientWidth,
          h: el.clientHeight,
        };
        const { w: iw, h: ih } = baseDimsRef.current;
        const t = clampTranslation(newTx, newTy, newScale, cw, ch, iw, ih);

        shouldTransitionRef.current = false;
        setScale(newScale);
        setTranslateX(t.tx);
        setTranslateY(t.ty);
      } else if (s > 1.01) {
        // Two-finger trackpad scroll while zoomed → pan
        e.preventDefault();

        const tx = txRef.current;
        const ty = tyRef.current;
        const newTx = tx - e.deltaX;
        const newTy = ty - e.deltaY;

        const { w: iw, h: ih } = baseDimsRef.current;
        const t = clampTranslation(newTx, newTy, s, el.clientWidth, el.clientHeight, iw, ih);

        shouldTransitionRef.current = false;
        setTranslateX(t.tx);
        setTranslateY(t.ty);
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (scaleRef.current <= 1) return;
      if (e.button !== 0) return;
      e.preventDefault();

      isPanningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: txRef.current,
        ty: tyRef.current,
      };
      shouldTransitionRef.current = false;

      const onMove = (ev: MouseEvent) => {
        if (!isPanningRef.current || !panStartRef.current) return;
        const dx = ev.clientX - panStartRef.current.x;
        const dy = ev.clientY - panStartRef.current.y;
        const newTx = panStartRef.current.tx + dx;
        const newTy = panStartRef.current.ty + dy;

        const el = containerRef.current;
        if (!el) return;
        const { w: iw, h: ih } = baseDimsRef.current;
        const s = scaleRef.current;
        const t = clampTranslation(newTx, newTy, s, el.clientWidth, el.clientHeight, iw, ih);
        setTranslateX(t.tx);
        setTranslateY(t.ty);
      };

      const onUp = () => {
        isPanningRef.current = false;
        setIsPanning(false);
        panStartRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [containerRef]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const s = scaleRef.current;
      if (s > 1.01) {
        // Zoomed in → reset to fit
        applyZoom(1, 0, 0, true);
      } else {
        // At fit → zoom to double-click point
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left - rect.width / 2;
        const cursorY = e.clientY - rect.top - rect.height / 2;

        const ratio = DOUBLE_CLICK_ZOOM / s;
        const newTx = cursorX - cursorX * ratio;
        const newTy = cursorY - cursorY * ratio;
        applyZoom(DOUBLE_CLICK_ZOOM, newTx, newTy, true);
      }
    },
    [applyZoom, containerRef]
  );

  // Recapture base dims on window resize
  useEffect(() => {
    const onResize = () => {
      const img = imageRef.current;
      if (img && scaleRef.current <= 1) {
        baseDimsRef.current = { w: img.offsetWidth, h: img.offsetHeight };
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [imageRef]);

  return useMemo(
    () => ({
      scale,
      translateX,
      translateY,
      isZoomed,
      zoomPercent,
      transformStyle,
      cursorStyle,
      shouldTransition,
      handleMouseDown,
      handleDoubleClick,
      handleImageLoad,
      zoomIn,
      zoomOut,
      zoomToFit,
      reset,
    }),
    [
      scale,
      translateX,
      translateY,
      isZoomed,
      zoomPercent,
      transformStyle,
      cursorStyle,
      shouldTransition,
      handleMouseDown,
      handleDoubleClick,
      handleImageLoad,
      zoomIn,
      zoomOut,
      zoomToFit,
      reset,
    ]
  );
}
