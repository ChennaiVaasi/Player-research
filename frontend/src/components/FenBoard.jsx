import { FILES, RANKS, parseFenBoard } from "../lib/fen";

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

function orientation(color) {
  return color === "Black"
    ? { files: [...FILES].reverse(), ranks: [...RANKS].reverse() }
    : { files: FILES, ranks: RANKS };
}

export default function FenBoard({ fen, color = "White" }) {
  const board = parseFenBoard(fen || "");
  const { files, ranks } = orientation(color);

  return (
    <div className="board-panel">
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
                  <div key={square} className={`sq ${isLight ? "light" : "dark"}`}>
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
    </div>
  );
}
