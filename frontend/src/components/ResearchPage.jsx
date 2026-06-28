import { useEffect, useState } from "react";

import { labelize } from "../lib/fen";


const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function ResearchPage() {
  const [payload, setPayload] = useState(null);
  const [playerId, setPlayerId] = useState("all");
  const [topicCount, setTopicCount] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          playerId,
          topicCount: String(topicCount)
        });
        const response = await fetch(`${API_BASE}/api/research-dashboard?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!active) return;
        setPayload(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Failed to load research generator");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [playerId, topicCount]);

  if (loading) {
    return <div className="card hero"><h1>Loading research generator...</h1></div>;
  }

  if (error) {
    return <div className="card hero"><h1>Research generator failed to load</h1><p>{error}</p></div>;
  }

  const players = payload?.availablePlayers || [];
  const topics = payload?.topics || [];
  const familyBreakdown = payload?.intentFamilyBreakdown || [];

  return (
    <div className="research-page">
      <header className="hero card">
        <div>
          <div className="eyebrow">Research Generator</div>
          <h1>Generate practical training topics from decision moments</h1>
          <p className="muted">{payload?.message}</p>
        </div>
        <div className="stat-row">
          <div className="stat"><span>Subject</span><strong>{payload?.subjectLabel || "-"}</strong></div>
          <div className="stat"><span>Decisions</span><strong>{payload?.decisionCount ?? 0}</strong></div>
          <div className="stat"><span>Persona</span><strong>{payload?.personaPrimary || "Unknown"}</strong></div>
        </div>
      </header>

      <section className="card research-controls">
        <div className="analysis-fields">
          <label>
            Player
            <select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              <option value="all">All players</option>
              {players.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.playerName} ({player.decisionMomentsFound})
                </option>
              ))}
            </select>
          </label>
          <label>
            Topic count
            <input type="number" min="4" max="24" value={topicCount} onChange={(event) => setTopicCount(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="research-grid">
        <div className="card research-panel">
          <h2>Signal breakdown</h2>
          <div className="reason-bars">
            {familyBreakdown.map((item) => (
              <div key={item.label}>
                <div className="bar-label">
                  <span>{labelize(item.label)}</span>
                  <span>{item.count}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${payload?.decisionCount ? (item.count / payload.decisionCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card research-panel">
          <h2>Generated topic bank</h2>
          <p className="muted">These are practical lesson ideas pulled from repeated equal-choice moments, not from random blunders.</p>
          <div className="research-topic-grid">
            {topics.map((topic) => (
              <article className="research-topic-card" key={topic.id}>
                <div className="topline">
                  <span>{topic.signalCount} signals</span>
                  <span>{topic.sharePct}% of sample</span>
                </div>
                <h3>{topic.title}</h3>
                <p>{topic.description}</p>
                <p className="muted small">{topic.whyItFits}</p>
                <div className="chip-row compact">
                  {topic.examples.map((example) => (
                    <span className="pill" key={`${topic.id}-${example.positionId}`}>
                      {example.playerName}: {example.move} vs {example.engineMove}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
