import ReactChessboard from "./ReactChessboard";

export default function FenBoard({ fen, color = "White" }) {
  return <ReactChessboard fen={fen} color={color} />;
}
