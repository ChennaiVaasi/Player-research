import { useEffect, useState } from "react";

import { inferMove } from "../lib/fen";
import ReactChessboard from "./ReactChessboard";

export default function ChessBoard({ decision, mode, onModeChange }) {
  const [displayFen, setDisplayFen] = useState(decision?.fenBeforeMove || "");
  const [highlights, setHighlights] = useState([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationToken, setAnimationToken] = useState(0);

  const side = decision?.playerColor || "White";

  useEffect(() => {
    if (!decision) return;
    setDisplayFen(fenForMode(decision, mode));
    setHighlights([]);
    setIsAnimating(false);
  }, [decision, mode]);

  useEffect(() => {
    return () => window.clearTimeout(animationToken);
  }, [animationToken]);

  function fenForMode(row, nextMode) {
    if (!row) return "";
    if (nextMode === "chosen") return row.fenAfterChosenMove || row.fenBeforeMove || "";
    if (nextMode === "best") return row.fenAfterBestMove || row.fenBeforeMove || "";
    return row.fenBeforeMove || "";
  }

  function play(nextMode) {
    if (!decision) return;
    window.clearTimeout(animationToken);
    const beforeFen = decision.fenBeforeMove || "";
    const targetFen = fenForMode(decision, nextMode);
    const move = inferMove(beforeFen, targetFen, side === "White" ? "white" : "black");
    setDisplayFen(beforeFen);
    setHighlights(move ? [move.from, move.to] : []);
    setIsAnimating(true);
    onModeChange(nextMode);
    const timeoutId = window.setTimeout(() => {
      setDisplayFen(targetFen);
      setHighlights(move ? [move.to] : []);
      setIsAnimating(false);
    }, 420);
    setAnimationToken(timeoutId);
  }

  return (
    <section className="board-panel">
      <div className="board-toolbar">
        <div className="chip-row">
          <button className={mode === "before" ? "active" : ""} onClick={() => onModeChange("before")} type="button">Before</button>
          <button className={mode === "chosen" ? "active" : ""} onClick={() => play("chosen")} type="button">After chosen</button>
          <button className={mode === "best" ? "active" : ""} onClick={() => play("best")} type="button">After engine</button>
        </div>
        <div className="muted small">{decision ? `${decision.sideToMove} to move • move ${decision.moveNumber}` : "Select a decision"}</div>
      </div>
      <ReactChessboard fen={displayFen} color={side} highlights={highlights} boardClassName={isAnimating ? "board-animating" : ""} />
    </section>
  );
}
