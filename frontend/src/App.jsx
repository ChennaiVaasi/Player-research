import { useEffect, useMemo, useState } from "react";

import ChessBoard from "./components/ChessBoard";
import DecisionDetail from "./components/DecisionDetail";
import DecisionList from "./components/DecisionList";
import Filters from "./components/Filters";
import PersonaPage from "./components/PersonaPage";
import ResearchPage from "./components/ResearchPage";
import { intentFamily, labelize } from "./lib/fen";


const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const PAGE_DECISIONS = "decisions";
const PAGE_PERSONA = "persona";
const PAGE_RESEARCH = "research";

function byPlayerName(playersById, playerId) {
  return playersById.get(playerId)?.playerName || "";
}

function pageFromLocation() {
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (pathname.endsWith("/persona") || hash === "#/persona" || hash === "#persona") return PAGE_PERSONA;
  if (pathname.endsWith("/research") || hash === "#/research" || hash === "#research") return PAGE_RESEARCH;
  return PAGE_DECISIONS;
}

function AnalysisPrepCard({ runs, onRunCreated }) {
  const [runName, setRunName] = useState("");
  const [batchSize, setBatchSize] = useState(20);
  const [pgn, setPgn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_name: runName,
          batch_size: Number(batchSize) || 20,
          pgn
        })
      });
      const data = await response.json();
      if (!response.ok || data.status === "invalid") {
        throw new Error(data.message || `HTTP ${response.status}`);
      }
      setMessage(`${data.runName} prepared: ${data.gameCount} games in ${data.estimatedBatchCount} batches.`);
      setPgn("");
      setRunName("");
      onRunCreated(data);
    } catch (submitError) {
      setError(submitError.message || "Failed to prepare analysis run");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card analysis-card">
      <div className="viewer-head">
        <div>
          <div className="eyebrow">Analysis Prep</div>
          <h2>Prepare a new PGN run</h2>
          <p className="muted">
            Paste PGN, keep the default batch size of 20 if you want, and the app will save a prepared run in the repo backend.
          </p>
        </div>
      </div>

      <form className="analysis-form" onSubmit={handleSubmit}>
        <div className="analysis-fields">
          <label>
            Run name
            <input value={runName} onChange={(event) => setRunName(event.target.value)} placeholder="June upload, club sample, rapid batch..." />
          </label>
          <label>
            Batch size
            <input type="number" min="1" max="200" value={batchSize} onChange={(event) => setBatchSize(event.target.value)} />
          </label>
        </div>
        <label>
          PGN input
          <textarea
            className="analysis-textarea"
            value={pgn}
            onChange={(event) => setPgn(event.target.value)}
            placeholder={'[Event "Example"]\n[White "Player A"]\n[Black "Player B"]\n\n1. e4 e5 2. Nf3 Nc6 *'}
          />
        </label>
        <div className="analysis-actions">
          <button type="submit" disabled={submitting}>{submitting ? "Preparing..." : "Prepare analysis run"}</button>
          {message ? <span className="analysis-success">{message}</span> : null}
          {error ? <span className="analysis-error">{error}</span> : null}
        </div>
      </form>

      <div className="analysis-run-list">
        <div className="list-head">
          <h2>Recent prepared runs</h2>
          <p className="muted">The engine pipeline is still the next wiring step, but the upload and batching workflow now lives in the app.</p>
        </div>
        <div className="analysis-run-grid">
          {runs.length ? runs.slice(0, 6).map((run) => (
            <div className="mini-card" key={run.runId}>
              <h3>{run.runName}</h3>
              <div className="detail-row-list">
                <div className="detail-row"><span>Status: {labelize(run.status)}</span></div>
                <div className="detail-row"><span>Games: {run.gameCount}</span></div>
                <div className="detail-row"><span>Eligible: {run.eligibleGames}</span></div>
                <div className="detail-row"><span>Batches: {run.estimatedBatchCount} at {run.batchSize}</span></div>
              </div>
            </div>
          )) : <p className="muted">No prepared runs yet.</p>}
        </div>
      </div>
    </section>
  );
}

function DecisionExplorerPage() {
  const [payload, setPayload] = useState(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("all");
  const [chosenIntentFamily, setChosenIntentFamily] = useState("all");
  const [engineIntentFamily, setEngineIntentFamily] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPositionId, setSelectedPositionId] = useState("");
  const [mode, setMode] = useState("before");
  const [overrides, setOverrides] = useState({});
  const [analysisRuns, setAnalysisRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/api/dashboard`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!active) return;
        setPayload(data);
        setOverrides(data.overrides || {});
        setAnalysisRuns(data.analysisRuns || []);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Failed to load dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const players = payload?.players || [];
  const decisions = payload?.decisions || [];
  const overview = payload?.overview;
  const intentOptions = payload?.intentOptions || [];
  const families = payload?.intentFamilies || [];
  const playersById = useMemo(() => new Map(players.map((player) => [player.playerId, player])), [players]);

  const filteredDecisions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return decisions.filter((row) => {
      const effectiveIntent = overrides[row.positionId] || row.chosenIntent;
      const chosenFamily = intentFamily(effectiveIntent);
      const engineFamilies = row.engineIntentFamilies || [];
      if (selectedPlayerId !== "all" && row.playerId !== selectedPlayerId) return false;
      if (chosenIntentFamily !== "all" && chosenFamily !== chosenIntentFamily) return false;
      if (engineIntentFamily !== "all" && !engineFamilies.includes(engineIntentFamily)) return false;
      if (!needle) return true;
      const haystack = [
        row.playerName,
        row.playedMoveSan,
        row.bestMoveSan,
        row.positionId,
        row.fenBeforeMove,
        row.personaSignal,
        row.decisionType,
        effectiveIntent,
        chosenFamily,
        ...(row.engineIntents || []),
        ...engineFamilies
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [chosenIntentFamily, decisions, engineIntentFamily, overrides, search, selectedPlayerId]);

  useEffect(() => {
    if (!filteredDecisions.length) {
      setSelectedPositionId("");
      return;
    }
    if (!filteredDecisions.some((row) => row.positionId === selectedPositionId)) {
      setSelectedPositionId(filteredDecisions[0].positionId);
      setMode("before");
    }
  }, [filteredDecisions, selectedPositionId]);

  const selectedDecision = filteredDecisions.find((row) => row.positionId === selectedPositionId) || null;
  const selectedPlayer = selectedDecision ? playersById.get(selectedDecision.playerId) : playersById.get(selectedPlayerId);
  const effectiveIntent = selectedDecision ? (overrides[selectedDecision.positionId] || selectedDecision.chosenIntent) : "unclear";

  async function saveOverride(nextIntent) {
    if (!selectedDecision) return;
    setOverrides((current) => ({ ...current, [selectedDecision.positionId]: nextIntent }));
    await fetch(`${API_BASE}/api/overrides/${selectedDecision.positionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: nextIntent })
    });
  }

  async function resetOverride() {
    if (!selectedDecision) return;
    const next = { ...overrides };
    delete next[selectedDecision.positionId];
    setOverrides(next);
    await fetch(`${API_BASE}/api/overrides/${selectedDecision.positionId}`, { method: "DELETE" });
  }

  function handleRunCreated(run) {
    setAnalysisRuns((current) => [run, ...current.filter((item) => item.runId !== run.runId)]);
  }

  if (loading) {
    return <div className="app-shell"><div className="hero card"><h1>Loading dashboard...</h1></div></div>;
  }

  if (error) {
    return <div className="app-shell"><div className="hero card"><h1>Dashboard failed to load</h1><p>{error}</p></div></div>;
  }

  return (
    <div className="app-shell">
      <header className="hero card">
        <div>
          <div className="eyebrow">Decision Persona Dashboard</div>
          <h1>Equal-choice moments as a real web app</h1>
          <p className="muted">
            Browse engine-close decisions, inspect the board, tune intent labels, and prepare new PGN runs from the same full-stack app.
          </p>
        </div>
        <div className="stat-row">
          <div className="stat"><span>Games</span><strong>{overview?.gamesAnalyzed ?? 0}</strong></div>
          <div className="stat"><span>Moments</span><strong>{overview?.decisionMomentsFound ?? 0}</strong></div>
          <div className="stat"><span>Players</span><strong>{overview?.playersFound ?? 0}</strong></div>
        </div>
      </header>

      <AnalysisPrepCard runs={analysisRuns} onRunCreated={handleRunCreated} />

      <div className="layout">
        <Filters
          players={players}
          selectedPlayerId={selectedPlayerId}
          onPlayerChange={setSelectedPlayerId}
          chosenIntentFamily={chosenIntentFamily}
          onChosenIntentFamilyChange={setChosenIntentFamily}
          engineIntentFamily={engineIntentFamily}
          onEngineIntentFamilyChange={setEngineIntentFamily}
          search={search}
          onSearchChange={setSearch}
          families={families}
          momentCount={filteredDecisions.length}
        />

        <main className="main-column">
          <section className="card viewer-card">
            <div className="viewer-head">
              <div>
                <div className="eyebrow">Viewer</div>
                <h2>{selectedDecision ? `${selectedDecision.playerName}: ${selectedDecision.playedMoveSan}` : "Select a decision"}</h2>
                <p className="muted">
                  {selectedPlayer
                    ? `${byPlayerName(playersById, selectedPlayer.playerId) || selectedPlayer.playerName} - ${selectedPlayer.personaPrimary || "Unknown persona"}`
                    : "Use the list to inspect a decision."}
                </p>
              </div>
              {selectedDecision ? (
                <div className="chip-row">
                  <span className="pill">{labelize(effectiveIntent)}</span>
                  <span className="pill subtle">{labelize(intentFamily(effectiveIntent))}</span>
                </div>
              ) : null}
            </div>
            <ChessBoard decision={selectedDecision} mode={mode} onModeChange={setMode} />
          </section>

          <DecisionDetail
            decision={selectedDecision}
            effectiveIntent={effectiveIntent}
            overrideIntent={effectiveIntent}
            intentOptions={intentOptions}
            onSaveOverride={saveOverride}
            onResetOverride={resetOverride}
          />
        </main>

        <DecisionList
          decisions={filteredDecisions}
          activeId={selectedPositionId}
          onSelect={(positionId) => {
            setSelectedPositionId(positionId);
            setMode("before");
          }}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState(pageFromLocation);

  useEffect(() => {
    function handleRouteChange() {
      setPage(pageFromLocation());
    }
    window.addEventListener("popstate", handleRouteChange);
    window.addEventListener("hashchange", handleRouteChange);
    return () => {
      window.removeEventListener("popstate", handleRouteChange);
      window.removeEventListener("hashchange", handleRouteChange);
    };
  }, []);

  function navigate(nextPage) {
    const nextPath = nextPage === PAGE_PERSONA ? "/persona" : nextPage === PAGE_RESEARCH ? "/research" : "/decisions";
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
    }
    setPage(nextPage);
  }

  return (
    <div className="page-shell">
      <nav className="top-nav">
        <button
          type="button"
          className={`nav-link ${page === PAGE_DECISIONS ? "active" : ""}`}
          onClick={() => navigate(PAGE_DECISIONS)}
        >
          Decision Explorer
        </button>
        <button
          type="button"
          className={`nav-link ${page === PAGE_RESEARCH ? "active" : ""}`}
          onClick={() => navigate(PAGE_RESEARCH)}
        >
          Research Generator
        </button>
        <button
          type="button"
          className={`nav-link ${page === PAGE_PERSONA ? "active" : ""}`}
          onClick={() => navigate(PAGE_PERSONA)}
        >
          Persona Summary
        </button>
      </nav>
      {page === PAGE_PERSONA ? <PersonaPage /> : page === PAGE_RESEARCH ? <ResearchPage /> : <DecisionExplorerPage />}
    </div>
  );
}
