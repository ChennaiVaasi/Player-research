import { intentFamily, labelize } from "../lib/fen";

function DetailRow({ label, value, mono = false }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={mono ? "mono" : ""}>{value || "-"}</span>
    </div>
  );
}

export default function DecisionDetail({ decision, effectiveIntent, overrideIntent, intentOptions, onSaveOverride, onResetOverride }) {
  if (!decision) {
    return <section className="card">Choose a position to inspect it.</section>;
  }

  const effectiveFamily = intentFamily(effectiveIntent);

  return (
    <section className="detail-stack">
      <div className="card">
        <div className="detail-head">
          <div>
            <h2>{decision.playerName}: {decision.playedMoveSan}</h2>
            <div className="muted">
              Move {decision.moveNumber} • {decision.playerColor} to move • {decision.positionId}
            </div>
          </div>
        </div>
        <div className="meta-grid">
          <div className="mini-card">
            <h3>Chosen move</h3>
            <DetailRow label="Played" value={`${decision.playedMoveSan} (${decision.playedMoveUci})`} />
            <DetailRow label="Intent" value={labelize(effectiveIntent)} />
            <DetailRow label="Family" value={labelize(effectiveFamily)} />
            <DetailRow label="Eval" value={`${decision.playedMoveEvalCp} cp`} />
          </div>
          <div className="mini-card">
            <h3>Engine top 3</h3>
            <DetailRow label="1" value={`${decision.bestMoveSan} • ${decision.bestEvalCp} cp • ${labelize(decision.bestMoveIntent)} (${labelize(decision.bestMoveIntentFamily)})`} />
            <DetailRow label="2" value={`${decision.secondMoveSan} • ${decision.secondEvalCp} cp • ${labelize(decision.secondMoveIntent)} (${labelize(decision.secondMoveIntentFamily)})`} />
            <DetailRow label="3" value={`${decision.thirdMoveSan} • ${decision.thirdEvalCp} cp • ${labelize(decision.thirdMoveIntent)} (${labelize(decision.thirdMoveIntentFamily)})`} />
          </div>
          <div className="mini-card">
            <h3>Decision lens</h3>
            <DetailRow label="Persona" value={decision.personaSignal} />
            <DetailRow label="Decision type" value={labelize(decision.decisionType)} />
            <DetailRow label="Gap top 2" value={`${decision.gapTop2Cp} cp`} />
            <DetailRow label="Gap top 3" value={`${decision.gapTop3Cp} cp`} />
          </div>
          <div className="mini-card">
            <h3>Engine reading</h3>
            <DetailRow label="Best move does" value={decision.engineBestMoveDoes || "-"} />
            <DetailRow label="Played move missed" value={decision.playerFailedToDo || "-"} />
            <DetailRow label="Explanation" value={decision.explanation || "-"} />
          </div>
          <div className="mini-card">
            <h3>Position</h3>
            <DetailRow label="Game" value={decision.gameIdFull || decision.gameId} />
            <DetailRow label="Player" value={`${decision.playerName} (${decision.playerRating || "?"})`} />
            <DetailRow label="FEN" value={decision.fenBeforeMove} mono />
          </div>
        </div>
      </div>
      <div className="card">
        <h2>Intent override</h2>
        <div className="override-row">
          <select value={overrideIntent} onChange={(event) => onSaveOverride(event.target.value)}>
            {intentOptions.map((option) => (
              <option key={option} value={option}>{labelize(option)}</option>
            ))}
          </select>
          <button type="button" onClick={onResetOverride}>Reset</button>
        </div>
      </div>
    </section>
  );
}
