"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/stores/watchlist";
import type { WatchItem } from "@/types/stock";

interface AlertDialogProps {
  item: WatchItem | null;
  onClose: () => void;
  currentPrice?: number;
}

export function AlertDialog({ item, onClose, currentPrice }: AlertDialogProps) {
  const setTargets = useWatchlist((s) => s.setTargets);
  const [up, setUp] = useState("");
  const [down, setDown] = useState("");

  useEffect(() => {
    setUp(item?.targetUp != null ? String(item.targetUp) : "");
    setDown(item?.targetDown != null ? String(item.targetDown) : "");
  }, [item]);

  if (!item) return null;

  const save = () => {
    const upVal = up.trim() === "" ? null : Number(up);
    const downVal = down.trim() === "" ? null : Number(down);
    if (upVal !== null && Number.isNaN(upVal)) return;
    if (downVal !== null && Number.isNaN(downVal)) return;
    setTargets(item.ticker, item.market, { up: upVal, down: downVal });
    onClose();
  };

  return (
    <Dialog
      open={item != null}
      onClose={onClose}
      title={`${item.ticker} 알림 설정`}
      description={
        currentPrice != null
          ? `현재가 기준으로 목표가를 설정하세요 (현재 ${currentPrice})`
          : "목표가를 설정하세요"
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500">상승 목표가 (도달 시 알림)</label>
          <Input
            type="number"
            inputMode="decimal"
            value={up}
            onChange={(e) => setUp(e.target.value)}
            placeholder="예: 150"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500">하락 목표가 (도달 시 알림)</label>
          <Input
            type="number"
            inputMode="decimal"
            value={down}
            onChange={(e) => setDown(e.target.value)}
            placeholder="예: 100"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">
            취소
          </Button>
          <Button variant="primary" onClick={save} type="button">
            저장
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
