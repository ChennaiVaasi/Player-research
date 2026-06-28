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

const PIECE_LABELS = {
  P: "White pawn",
  N: "White knight",
  B: "White bishop",
  R: "White rook",
  Q: "White queen",
  K: "White king",
  p: "Black pawn",
  n: "Black knight",
  b: "Black bishop",
  r: "Black rook",
  q: "Black queen",
  k: "Black king"
};

function orientation(color) {
  return color === "Black"
    ? { files: [...FILES].reverse(), ranks: [...RANKS].reverse() }
    : { files: FILES, ranks: RANKS };
}

function isLightSquare(file, rank) {
  return (FILES.indexOf(file) + Number(rank)) % 2 === 0;
}

export default function ReactChessboard({
  fen,
  color = "White",
  highlights = [],
  boardClassName = "",
  showCoordinates = true,
}) {
  const board = parseFenBoard(fen || "");
  const { files, ranks } = orientation(color);
  const highlightedSquares = new Set(highlights);

  return (
    <div className={`board-panel ${boardClassName}`.trim()}>
      <div className="board-shell">
        <div className="ranks">
          {ranks.map((rank) => <div key={`left-${rank}`}>{rank}</div>)}
        </div>
        <div>
          <div className="board react-board">
            {ranks.map((rank) =>
              files.map((file) => {
                const sourceRowIndex = 8 - Number(rank);
                const sourceColIndex = FILES.indexOf(file);
                const piece = board[sourceRowIndex]?.[sourceColIndex] || "";
                const square = `${file}${rank}`;
                return (
                  <div
                    key={square}
                    className={`sq ${isLightSquare(file, rank) ? "light" : "dark"} ${highlightedSquares.has(square) ? "highlight" : ""}`}
                    data-square={square}
                    aria-label={square}
                  >
                    {piece ? (
                      <img
                        className="piece react-piece"
                        src={PIECE_MAP[piece]}
                        alt={PIECE_LABELS[piece] || piece}
                        draggable="false"
                      />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          {showCoordinates ? (
            <div className="files">
              {files.map((file) => <div key={`file-${file}`}>{file}</div>)}
            </div>
          ) : null}
        </div>
        <div className="ranks">
          {ranks.map((rank) => <div key={`right-${rank}`}>{rank}</div>)}
        </div>
      </div>
    </div>
  );
}
