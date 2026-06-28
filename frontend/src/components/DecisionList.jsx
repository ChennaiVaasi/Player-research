import { labelize } from "../lib/fen";

export default function DecisionList({ decisions, activeId, onSelect }) {
  return (
    <section className="card list-card">
      <div className="list-head">
        <h2>Moments</h2>
      </div>
      <div className="decision-list">
        {decisions.map((row) => (
          <button
            key={row.positionId}
            className={`decision-item ${row.positionId === activeId ? "active" : ""}`}
            type="button"
            onClick={() => onSelect(row.positionId)}
          >
            <div className="topline">
              <span>{row.playerName}</span>
              <span>{row.playerRating || "?"}</span>
            </div>
            <strong>{row.playedMoveSan}</strong>
            <div className="muted small">Move {row.moveNumber} • {row.playerColor}</div>
            <div className="chip-row compact">
              <span className="pill">{labelize(row.chosenIntent)}</span>
              <span className="pill subtle">{labelize(row.chosenIntentFamily)}</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

