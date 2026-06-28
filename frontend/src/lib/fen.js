export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export function parseFenBoard(fen) {
  const placement = String(fen || "").split(" ")[0] || "";
  const rows = placement.split("/");
  const board = rows.map((row) => {
    const expanded = [];
    for (const char of row) {
      if (/\d/.test(char)) {
        for (let index = 0; index < Number(char); index += 1) expanded.push("");
      } else {
        expanded.push(char);
      }
    }
    while (expanded.length < 8) expanded.push("");
    return expanded.slice(0, 8);
  });
  while (board.length < 8) board.push(new Array(8).fill(""));
  return board;
}

export function boardToMap(board) {
  const map = {};
  for (let rankIndex = 0; rankIndex < 8; rankIndex += 1) {
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      const piece = board[rankIndex]?.[fileIndex] || "";
      if (!piece) continue;
      map[`${FILES[fileIndex]}${8 - rankIndex}`] = piece;
    }
  }
  return map;
}

export function pieceColor(piece) {
  if (!piece) return "";
  return piece === piece.toUpperCase() ? "white" : "black";
}

export function inferMove(beforeFen, afterFen, moverColor) {
  if (!beforeFen || !afterFen || beforeFen === afterFen) return null;
  const beforeMap = boardToMap(parseFenBoard(beforeFen));
  const afterMap = boardToMap(parseFenBoard(afterFen));
  const squares = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]);
  const fromCandidates = [];
  const toCandidates = [];

  for (const square of squares) {
    const beforePiece = beforeMap[square] || "";
    const afterPiece = afterMap[square] || "";
    if (beforePiece === afterPiece) continue;
    if (beforePiece && pieceColor(beforePiece) === moverColor && (!afterPiece || afterPiece !== beforePiece)) {
      fromCandidates.push({ square, piece: beforePiece });
    }
    if (afterPiece && pieceColor(afterPiece) === moverColor && (!beforePiece || beforePiece !== afterPiece)) {
      toCandidates.push({ square, piece: afterPiece });
    }
  }

  if (!fromCandidates.length || !toCandidates.length) return null;
  const kingFrom = fromCandidates.find((item) => item.piece.toLowerCase() === "k");
  const kingTo = toCandidates.find((item) => item.piece.toLowerCase() === "k");
  return {
    from: (kingFrom || fromCandidates[0]).square,
    to: (kingTo || toCandidates[0]).square
  };
}

export function intentFamily(intent) {
  if (["material_gain", "material_safety", "trade", "avoid_trade"].includes(intent)) return "material";
  if (["central_control", "space_gain"].includes(intent)) return "space";
  if (["king_safety", "defense", "prophylaxis"].includes(intent)) return "king_safety";
  if (intent === "pawn_break") return "pawn_structure";
  return "piece_activity";
}

export function labelize(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

