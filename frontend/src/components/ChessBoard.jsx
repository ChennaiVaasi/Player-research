import { useEffect, useMemo, useRef, useState } from "react";

import { FILES, RANKS, inferMove, parseFenBoard } from "../lib/fen";


const PIECE_MAP = {
  P: "/pieces/White-Pawn.svg",
  N: "/pieces/White-Knight.svg",
  B: "/pieces/White-Bishop.svg",
  R: "/pieces/White-Rook.svg",
  Q: "/pieces/White-Queen.svg",
  K: "/pieces/White-King.svg",
  p: "/pieces/Black-Pawn.svg",
  n: "/pieces/Black-Knight.svg",
  b: "/pieces/Black-Bishop.svg",
  r: "/pieces/Black-Rook.svg",
  q: "/pieces/Black-Queen.svg",
  k: "/pieces/Black-King.svg"
};

function orientation(sideToMove) {
  return sideToMove === "Black"
    ? { files: [...FILES].reverse(), ranks: [...RANKS].reverse() }
    : { files: FILES, ranks: RANKS };
}

export default function ChessBoard({ decision, mode, onModeChange }) {
  const [displayFen, setDisplayFen] = useState(decision?.fenBeforeMove || "");
  const [highlights, setHighlights] = useState([]);
  const timerRef = useRef([]);

  const side = decision?.playerColor || "White";
  const { files, ranks } = useMemo(() => orientation(side), [side]);
  const board = useMemo(() => parseFenBoard(displayFen), [displayFen]);

  useEffect(() => {
    clearTimers();
    if (!decision) return;
    setDisplayFen(fenForMode(decision, mode));
    setHighlights([]);
  }, [decision, mode]);

  useEffect(() => () => clearTimers(), []);

  function clearTimers() {
    while (timerRef.current.length) clearTimeout(timerRef.current.pop());
  }

  function fenForMode(row, nextMode) {
    if (!row) return "";
    if (nextMode === "chosen") return row.fenAfterChosenMove || row.fenBeforeMove || "";
    if (nextMode === "best") return row.fenAfterBestMove || row.fenBeforeMove || "";
    return row.fenBeforeMove || "";
  }

  function play(nextMode) {
    if (!decision) return;
    clearTimers();
    const beforeFen = decision.fenBeforeMove || "";
    const targetFen = fenForMode(decision, nextMode);
    const move = inferMove(beforeFen, targetFen, side === "White" ? "white" : "black");
    setDisplayFen(beforeFen);
    setHighlights(move ? [move.from, move.to] : []);
    onModeChange(nextMode);
    timerRef.current.push(
      window.setTimeout(() => {
        setDisplayFen(targetFen);
        setHighlights(move ? [move.to] : []);
      }, 500)
    );
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
      <div className="board-shell">
        <div className="ranks">
          {ranks.map((rank) => <div key={`left-${rank}`}>{rank}</div>)}
        </div>
        <div>
          <div className="board">
            {ranks.map((rank, rowIndex) =>
              files.map((file, colIndex) => {
                const sourceRowIndex = 8 - Number(rank);
                const sourceColIndex = FILES.indexOf(file);
                const piece = board[sourceRowIndex]?.[sourceColIndex] || "";
                const square = `${file}${rank}`;
                const isLight = (rowIndex + colIndex) % 2 === 0;
                return (
                  <div key={square} className={`sq ${isLight ? "light" : "dark"} ${highlights.includes(square) ? "highlight" : ""}`}>
                    {piece ? <img className="piece" src={PIECE_MAP[piece]} alt={piece} /> : null}
                  </div>
                );
              })
            )}
          </div>
          <div className="files">
            {files.map((file) => <div key={`file-${file}`}>{file}</div>)}
          </div>
        </div>
        <div className="ranks">
          {ranks.map((rank) => <div key={`right-${rank}`}>{rank}</div>)}
        </div>
      </div>
    </section>
  );
}

