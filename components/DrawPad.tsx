"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 128×128 캔버스 손그림 도구. 4가지 색 · 지우개 · 클리어 · dataUrl 콜백.
// 마우스/터치 모두 지원. onCommit(dataUrl) 은 "저장" 버튼 눌렀을 때만 호출.
const CANVAS_SIZE = 128;
const COLORS = ["#1A1108", "#D8384E", "#4CA9E8", "#5FA362", "#F4A932"];
const BRUSH = 4;

interface Props {
  initial?: string;
  onCommit: (dataUrl: string) => void;
  onCancel?: () => void;
}

export default function DrawPad({ initial, onCommit, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [erasing, setErasing] = useState(false);

  // 초기화: 배경 흰색 or 기존 그림
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (initial) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      img.src = initial;
    }
  }, [initial]);

  const posOf = useCallback((e: PointerEvent | React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    const sx = CANVAS_SIZE / rect.width;
    const sy = CANVAS_SIZE / rect.height;
    return {
      x: (e.clientX - rect.left) * sx,
      y: (e.clientY - rect.top) * sy,
    };
  }, []);

  const draw = useCallback(
    (x: number, y: number) => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = erasing ? BRUSH * 3 : BRUSH;
      ctx.strokeStyle = erasing ? "#FFFFFF" : color;
      ctx.beginPath();
      const last = lastRef.current;
      if (last) {
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(x, y);
      } else {
        // 첫 클릭 = 점
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.1, y + 0.1);
      }
      ctx.stroke();
      lastRef.current = { x, y };
    },
    [color, erasing]
  );

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = null;
    const p = posOf(e);
    draw(p.x, p.y);
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const p = posOf(e);
    draw(p.x, p.y);
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
  function commit() {
    const c = canvasRef.current;
    if (!c) return;
    onCommit(c.toDataURL("image/png"));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        {COLORS.map((col) => (
          <button
            key={col}
            type="button"
            onClick={() => {
              setColor(col);
              setErasing(false);
            }}
            aria-label={`색 ${col}`}
            style={{ backgroundColor: col }}
            className={`w-8 h-8 rounded-full border-2 ${
              !erasing && color === col
                ? "border-warning ring-2 ring-warning"
                : "border-cardEdge"
            }`}
          />
        ))}
        <button
          type="button"
          onClick={() => setErasing(true)}
          className={`ml-1 px-2 py-1 text-xs rounded-element border-2 ${
            erasing
              ? "border-warning bg-accentSoft"
              : "border-cardEdge bg-card"
          }`}
        >
          🧽 지우개
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          width: 200,
          height: 200,
          touchAction: "none",
          imageRendering: "pixelated",
          cursor: "crosshair",
          borderRadius: 8,
        }}
        className="border-2 border-cardEdge bg-paper mx-auto"
        aria-label="손그림 캔버스"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clear}
          className="flex-1 rounded-element border-2 border-cardEdge bg-card px-3 py-2 text-sm"
        >
          🗑️ 전체 지우기
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-element border-2 border-cardEdge bg-paper px-3 py-2 text-sm"
          >
            취소
          </button>
        )}
        <button
          type="button"
          onClick={commit}
          className="flex-1 rounded-element bg-success text-paper px-3 py-2 text-sm font-medium"
        >
          ✅ 사용
        </button>
      </div>
    </div>
  );
}
