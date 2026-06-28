import { labelize } from "../lib/fen";

export default function Filters({
  players,
  selectedPlayerId,
  onPlayerChange,
  chosenIntentFamily,
  onChosenIntentFamilyChange,
  engineIntentFamily,
  onEngineIntentFamilyChange,
  search,
  onSearchChange,
  families,
  momentCount
}) {
  return (
    <aside className="sidebar card">
      <h2>Browse Decisions</h2>
      <label>
        Player
        <select value={selectedPlayerId} onChange={(event) => onPlayerChange(event.target.value)}>
          <option value="all">All players</option>
          {players.map((player) => (
            <option key={player.playerId} value={player.playerId}>
              {player.playerName} ({player.decisionMomentsFound})
            </option>
          ))}
        </select>
      </label>
      <label>
        Chosen intent family
        <select value={chosenIntentFamily} onChange={(event) => onChosenIntentFamilyChange(event.target.value)}>
          <option value="all">All families</option>
          {families.map((family) => (
            <option key={family} value={family}>{labelize(family)}</option>
          ))}
        </select>
      </label>
      <label>
        Engine top-3 family
        <select value={engineIntentFamily} onChange={(event) => onEngineIntentFamilyChange(event.target.value)}>
          <option value="all">All families</option>
          {families.map((family) => (
            <option key={family} value={family}>{labelize(family)}</option>
          ))}
        </select>
      </label>
      <label>
        Search
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Player, move, intent, FEN" />
      </label>
      <div className="muted small">{momentCount} matching positions</div>
    </aside>
  );
}

