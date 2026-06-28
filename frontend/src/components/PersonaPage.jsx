import { useEffect, useMemo, useState } from "react";

import FenBoard from "./FenBoard";


const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const POSITION_PAGE_SIZE = 18;

const LENS_DISPLAY = {
  opening_discipline: {
    name: "Opening Reset",
    definition: "Do you stop and ask what this exact opening position needs, instead of playing a routine move by habit?"
  },
  endgame_conversion: {
    name: "Winning Endgame Technique",
    definition: "Can you convert better endings cleanly through king activity, patience, and accurate technique?"
  },
  quiet_judgment: {
    name: "Positional Choice",
    definition: "Can you choose the best plan in quieter positions where several moves look playable?"
  },
  forcing_instinct: {
    name: "Checks, Captures, Threats",
    definition: "Do you look for forcing moves first when the position becomes concrete?"
  },
  recapture_discipline: {
    name: "Recapture Recheck",
    definition: "Do you pause before the automatic recapture and re-evaluate the position?"
  },
  material_urgency: {
    name: "Take It or Leave It Judgment",
    definition: "Do you handle captures, trades, and material wins correctly when they compete with safety or activity?"
  },
  safety_discipline: {
    name: "Blunder Check",
    definition: "Do you do a final safety scan for loose pieces, king danger, and tactical punishment before moving?"
  },
  defensive_restraint: {
    name: "Defend First",
    definition: "When the position is dangerous, can you choose the stabilizing move before chasing activity?"
  },
  practical_resilience: {
    name: "Solid Practical Choices",
    definition: "Can you find sound useful moves in hard positions even when they are not flashy?"
  }
};

const FRAMEWORK_DISPLAY = {
  OPENING_AUTOPILOT: "Routine opening move without a reset",
  MISSED_CCT_SCAN: "Missed checks, captures, threats",
  ONLY_MOVE_MISSED: "Missed the only critical move",
  FORCING_MOVE_IGNORED: "Ignored the forcing move",
  CANDIDATE_MOVE_PRUNING: "Did not consider the key move",
  MATERIAL_GREED: "Grabbed material without a full check",
  EVAL_MISREAD: "Misjudged the position",
  HANGING_PIECE_BLINDNESS: "Missed a loose piece",
  NO_SAFETY_CHECK: "Skipped the final blunder check",
  KING_SAFETY_NEGLECT: "Ignored king danger",
  BACK_RANK_NEGLECT: "Forgot the back rank",
  RECAPTURE_AUTOPILOT: "Automatic recapture",
  ENDGAME_TECHNIQUE: "Inaccurate endgame technique",
  CONVERSION_IMPATIENCE: "Rushed the conversion",
  "Accurate forcing choice": "Found the forcing move",
  "Stable non-error decision": "Solid practical move"
};

function lensName(skill) {
  return LENS_DISPLAY[skill?.id]?.name || skill?.name || "Decision lens";
}

function lensDefinition(skill) {
  return LENS_DISPLAY[skill?.id]?.definition || skill?.summary || "";
}

function frameworkLabel(value) {
  return FRAMEWORK_DISPLAY[value] || String(value || "").replaceAll("_", " ");
}

function cplPeak(skill) {
  return Math.max(...(skill?.positions || []).map((position) => position.cpl || 0), 0);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function PersonaPage() {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skillIndex, setSkillIndex] = useState(0);
  const [positionIndex, setPositionIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE}/api/persona-dashboard`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!active) return;
        setPayload(data);
      } catch (loadError) {
        if (!active) return;
        setError(loadError.message || "Failed to load persona dashboard");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const skills = payload?.skills || [];
  const activeSkill = skills[skillIndex] || null;
  const positions = activeSkill?.positions || [];

  useEffect(() => {
    setPositionIndex(0);
    setPageIndex(0);
  }, [skillIndex]);

  useEffect(() => {
    if (!positions.length) {
      setPositionIndex(0);
      return;
    }
    if (positionIndex >= positions.length) {
      setPositionIndex(0);
    }
  }, [positionIndex, positions]);

  const totalPages = Math.max(1, Math.ceil(positions.length / POSITION_PAGE_SIZE));
  const effectivePageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = effectivePageIndex * POSITION_PAGE_SIZE;
  const pageEnd = Math.min(positions.length, pageStart + POSITION_PAGE_SIZE);
  const pagedPositions = positions.slice(pageStart, pageEnd);
  const activePosition = positions[positionIndex] || null;

  const reasonBars = useMemo(() => {
    if (!activeSkill) return [];
    const counts = {};
    activeSkill.positions.forEach((position) => {
      counts[position.framework] = (counts[position.framework] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([framework, count]) => ({
        framework,
        count,
        width: `${(count / activeSkill.positions.length) * 100}%`
      }));
  }, [activeSkill]);

  async function handleCopyFen() {
    if (!activePosition) return;
    await copyText(activePosition.fen);
    setCopyStatus("Copied FEN");
    window.setTimeout(() => setCopyStatus(""), 1000);
  }

  if (loading) {
    return <div className="card hero"><h1>Loading persona page...</h1></div>;
  }

  if (error) {
    return <div className="card hero"><h1>Persona page failed to load</h1><p>{error}</p></div>;
  }

  return (
    <div className="persona-page">
      <header className="hero card">
        <div>
          <div className="eyebrow">Persona Summary</div>
          <h1>Decision personas from equal-choice moments</h1>
          <p className="muted">
            This page summarizes the player model built from positions where several moves were still playable,
            so the signal comes from decision preference rather than only from direct tactical errors.
          </p>
        </div>
        <div className="stat-row">
          <div className="stat"><span>Games</span><strong>{payload?.gamesAnalyzed ?? 0}</strong></div>
          <div className="stat"><span>Moments</span><strong>{payload?.selectedMoments ?? 0}</strong></div>
          <div className="stat"><span>Lenses</span><strong>{skills.length}</strong></div>
        </div>
      </header>

      <section className="persona-summary-grid">
        <div className="card persona-panel">
          <h2>Strong Coverage</h2>
          <div className="chip-row">
            {(payload?.goodCoverage || []).map((item) => (
              <span className="pill" key={item}>{item}</span>
            ))}
          </div>
        </div>
        <div className="card persona-panel">
          <h2>Signal Notes</h2>
          <div className="detail-row-list">
            {(payload?.strongestSignals || []).map((item) => (
              <div className="detail-row" key={item}>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card persona-panel">
        <div className="list-head">
          <h2>Decision Lenses</h2>
          <p className="muted">Choose a lens to browse the equal-choice moments that shaped the persona.</p>
        </div>
        <div className="lens-grid">
          {skills.map((skill, index) => (
            <button
              key={skill.id}
              type="button"
              className={`lens-card ${index === skillIndex ? "active" : ""}`}
              onClick={() => setSkillIndex(index)}
            >
              <strong>{lensName(skill)}</strong>
              <span>{skill.positions.length} moments</span>
              <span>Peak swing {cplPeak(skill)} CPL</span>
            </button>
          ))}
        </div>
      </section>

      {activeSkill ? (
        <>
          <section className="persona-detail-grid">
            <div className="card persona-panel">
              <h2>{lensName(activeSkill)}</h2>
              <p>{lensDefinition(activeSkill)}</p>
              <p className="muted small">{activeSkill.caveat}</p>
              <div className="reason-bars">
                {reasonBars.map((item) => (
                  <div key={item.framework}>
                    <div className="bar-label">
                      <span>{frameworkLabel(item.framework)}</span>
                      <span>{item.count}/{activeSkill.positions.length}</span>
                    </div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: item.width }} /></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card persona-panel">
              <div className="viewer-head">
                <div>
                  <div className="eyebrow">Position Viewer</div>
                  <h2>{activePosition ? `${activePosition.focus}: ${activePosition.move}` : "Select a position"}</h2>
                  <p className="muted">
                    {activePosition
                      ? `${activePosition.date} • ${activePosition.game}`
                      : "Pick a moment from the list to inspect the position."}
                  </p>
                </div>
                {activePosition ? (
                  <div className="chip-row">
                    <span className="pill">{activePosition.severity}</span>
                    <span className="pill subtle">{frameworkLabel(activePosition.framework)}</span>
                  </div>
                ) : null}
              </div>
              {activePosition ? (
                <>
                  <FenBoard fen={activePosition.fen} color={activePosition.color} />
                  <div className="meta-grid">
                    <div className="mini-card">
                      <h3>Decision</h3>
                      <div className="detail-row-list">
                        <div className="detail-row"><span>Played: {activePosition.move}</span></div>
                        <div className="detail-row"><span>Engine: {activePosition.best}</span></div>
                        <div className="detail-row"><span>CPL loss: {activePosition.cpl}</span></div>
                        <div className="detail-row"><span>Difficulty: {activePosition.difficulty}</span></div>
                      </div>
                    </div>
                    <div className="mini-card">
                      <h3>Interpretation</h3>
                      <div className="detail-row-list">
                        <div className="detail-row"><span>{activePosition.why}</span></div>
                        <div className="detail-row"><span>Tags: {activePosition.types.join(", ")}</span></div>
                      </div>
                    </div>
                    <div className="mini-card">
                      <h3>FEN</h3>
                      <div className="detail-row-list">
                        <div className="detail-row"><span className="mono">{activePosition.fen}</span></div>
                        <button className="secondary-button" onClick={handleCopyFen} type="button">
                          {copyStatus || "Copy FEN"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </section>

          <section className="card persona-panel">
            <div className="viewer-head">
              <div>
                <h2>All Positions For This Lens</h2>
                <p className="muted">Showing {pageStart + 1}-{pageEnd} of {positions.length}</p>
              </div>
              <div className="chip-row">
                <button className="secondary-button" type="button" disabled={effectivePageIndex === 0} onClick={() => setPageIndex(0)}>First</button>
                <button className="secondary-button" type="button" disabled={effectivePageIndex === 0} onClick={() => setPageIndex((current) => Math.max(0, current - 1))}>Previous</button>
                <button className="secondary-button" type="button" disabled={effectivePageIndex >= totalPages - 1} onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}>Next</button>
                <button className="secondary-button" type="button" disabled={effectivePageIndex >= totalPages - 1} onClick={() => setPageIndex(totalPages - 1)}>Last</button>
              </div>
            </div>
            <div className="persona-position-grid">
              {pagedPositions.map((position, index) => {
                const absoluteIndex = pageStart + index;
                return (
                  <button
                    key={position.id}
                    type="button"
                    className={`persona-position-card ${absoluteIndex === positionIndex ? "active" : ""}`}
                    onClick={() => setPositionIndex(absoluteIndex)}
                  >
                    <div className="topline">
                      <span>{position.focus}</span>
                      <span>{position.cpl} CPL</span>
                    </div>
                    <strong>{position.move}</strong>
                    <div className="muted small">{position.best}</div>
                    <div className="muted small">{position.id}</div>
                    <div className="chip-row compact">
                      <span className="pill">{position.severity}</span>
                      <span className="pill subtle">{frameworkLabel(position.framework)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
