from __future__ import annotations

import csv
import json
import re
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable
from uuid import uuid4


INTENT_OPTIONS = [
    "attack",
    "defense",
    "development",
    "king_safety",
    "material_gain",
    "material_safety",
    "trade",
    "avoid_trade",
    "central_control",
    "space_gain",
    "pawn_break",
    "quiet_improvement",
    "piece_activity",
    "endgame_technical",
    "tactical_calculation",
    "prophylaxis",
    "unclear",
]

INTENT_FAMILIES = [
    "piece_activity",
    "material",
    "space",
    "king_safety",
    "pawn_structure",
]


class DataService:
    def __init__(self) -> None:
        self.root = Path(__file__).resolve().parents[3]
        self.source_root = self.root.parent
        self.output_dir = self.source_root / "analysis-output-decision-full"
        self.report_path = self.output_dir / "decision_moments_report.json"
        self.players_path = self.output_dir / "decision_moments_players.json"
        self.decisions_path = self.output_dir / "decision_moments.csv"
        self.overrides_path = self.root / "backend" / "data" / "intent_overrides.json"
        self.persona_dashboard_path = self.source_root / "site" / "persona-dashboard-data.js"
        self.analysis_runs_dir = self.root / "backend" / "data" / "analysis_runs"

    def get_dashboard_payload(self) -> dict[str, Any]:
        return {
            "overview": self.get_overview(),
            "players": self.get_players(),
            "decisions": self.get_decisions(),
            "overrides": self.get_overrides(),
            "analysisRuns": self.get_analysis_runs(),
            "intentOptions": INTENT_OPTIONS,
            "intentFamilies": INTENT_FAMILIES,
        }

    def get_persona_dashboard_payload(self) -> dict[str, Any]:
        return self._load_persona_dashboard()

    def get_research_dashboard(self, player_id: str = "all", topic_count: int = 12) -> dict[str, Any]:
        players = self.get_players()
        players_by_id = {player.get("playerId"): player for player in players}
        overrides = self.get_overrides()
        normalized_topic_count = max(4, min(int(topic_count or 12), 24))

        relevant_rows: list[dict[str, Any]] = []
        for source_row in self.get_decisions():
            if player_id != "all" and source_row.get("playerId") != player_id:
                continue
            row = dict(source_row)
            effective_intent = overrides.get(row["positionId"], row.get("chosenIntent") or "unclear")
            row["effectiveIntent"] = effective_intent
            row["effectiveIntentFamily"] = self.intent_family(effective_intent)
            relevant_rows.append(row)

        selected_player = players_by_id.get(player_id) if player_id != "all" else None
        persona_counter = Counter(row.get("personaSignal") or "Unclear" for row in relevant_rows)
        family_counter = Counter(row.get("effectiveIntentFamily") or "piece_activity" for row in relevant_rows)
        intent_counter = Counter(row.get("effectiveIntent") or "unclear" for row in relevant_rows)

        top_persona = persona_counter.most_common(1)[0][0] if persona_counter else (selected_player or {}).get("personaPrimary", "Unknown")
        topics = self._build_research_topics(relevant_rows, normalized_topic_count)

        return {
            "playerId": player_id,
            "subjectLabel": selected_player.get("playerName") if selected_player else "All players in the loaded decision dataset",
            "topicCountRequested": normalized_topic_count,
            "decisionCount": len(relevant_rows),
            "gamesAnalyzed": selected_player.get("gamesAnalyzed") if selected_player else self.get_overview().get("gamesAnalyzed"),
            "personaPrimary": selected_player.get("personaPrimary") if selected_player else top_persona,
            "personaSecondary": selected_player.get("personaSecondary") if selected_player else "",
            "intentFamilyBreakdown": [{"label": key, "count": value} for key, value in family_counter.most_common()],
            "intentBreakdown": [{"label": key, "count": value} for key, value in intent_counter.most_common(10)],
            "topics": topics,
            "availablePlayers": players,
            "message": "These topics are generated from equal-choice decision moments, so they point to repeat decision habits rather than one-off blunders.",
        }

    def get_overview(self) -> dict[str, Any]:
        report = self._read_json(self.report_path)
        return {
            "status": report.get("status", "unknown"),
            "gamesAnalyzed": self._to_int(report.get("gamesAnalyzed")),
            "decisionMomentsFound": self._to_int(report.get("decisionMomentsFound")),
            "rawDecisionMomentsFound": self._to_int(report.get("rawDecisionMomentsFound")),
            "playersFound": len(self.get_players()),
            "sourceDir": str(self.output_dir),
        }

    def get_players(self) -> list[dict[str, Any]]:
        payload = self._read_json(self.players_path)
        players = payload.get("players", [])
        return sorted(players, key=lambda item: (-self._to_int(item.get("decisionMomentsFound")), item.get("playerName", "")))

    def get_decisions(self) -> list[dict[str, Any]]:
        return self._load_decisions()

    def get_decision(self, position_id: str) -> dict[str, Any] | None:
        return next((row for row in self._load_decisions() if row.get("positionId") == position_id), None)

    def get_overrides(self) -> dict[str, str]:
        if not self.overrides_path.exists():
            return {}
        return self._read_json(self.overrides_path)

    def save_override(self, position_id: str, intent: str) -> dict[str, Any]:
        overrides = self.get_overrides()
        overrides[position_id] = intent
        self._write_json(self.overrides_path, overrides)
        return {"positionId": position_id, "intent": intent, "status": "saved"}

    def delete_override(self, position_id: str) -> dict[str, Any]:
        overrides = self.get_overrides()
        overrides.pop(position_id, None)
        self._write_json(self.overrides_path, overrides)
        return {"positionId": position_id, "status": "deleted"}

    def create_analysis_run(self, pgn: str, batch_size: int, run_name: str | None = None) -> dict[str, Any]:
        cleaned_pgn = (pgn or "").strip()
        if not cleaned_pgn:
            return {
                "status": "invalid",
                "message": "Paste at least one PGN game before starting an analysis run.",
            }

        normalized_batch_size = max(1, min(int(batch_size or 20), 200))
        games = self._extract_games(cleaned_pgn)
        if not games:
            return {
                "status": "invalid",
                "message": "No PGN games were detected in the pasted text.",
            }

        created_at = datetime.now(timezone.utc).isoformat()
        run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:6]}"
        run_dir = self.analysis_runs_dir / run_id
        run_dir.mkdir(parents=True, exist_ok=True)

        summary = self._summarize_games(games, normalized_batch_size, run_id, run_name, created_at)
        (run_dir / "input.pgn").write_text(cleaned_pgn, encoding="utf-8")
        self._write_json(run_dir / "summary.json", summary)
        return summary

    def get_analysis_runs(self) -> list[dict[str, Any]]:
        if not self.analysis_runs_dir.exists():
            return []
        runs: list[dict[str, Any]] = []
        for summary_path in self.analysis_runs_dir.glob("*/summary.json"):
            try:
                runs.append(self._read_json(summary_path))
            except (OSError, json.JSONDecodeError):
                continue
        return sorted(runs, key=lambda item: item.get("createdAt", ""), reverse=True)

    @lru_cache(maxsize=1)
    def _load_decisions(self) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        with self.decisions_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for raw in reader:
                rows.append(self._normalize_decision(raw))
        return rows

    def _normalize_decision(self, raw: dict[str, str]) -> dict[str, Any]:
        row = dict(raw)
        chosen_intent = row.get("chosenIntent") or "unclear"
        best_intent = row.get("bestMoveIntent") or "unclear"
        second_intent = row.get("secondMoveIntent") or row.get("alternativeIntent1") or "unclear"
        third_intent = row.get("thirdMoveIntent") or row.get("alternativeIntent2") or "unclear"

        row["chosenIntent"] = chosen_intent
        row["bestMoveIntent"] = best_intent
        row["secondMoveIntent"] = second_intent
        row["thirdMoveIntent"] = third_intent
        row["positionId"] = row.get("positionId") or self._build_position_id(row)
        row["chosenIntentFamily"] = row.get("chosenIntentFamily") or self.intent_family(chosen_intent)
        row["bestMoveIntentFamily"] = row.get("bestMoveIntentFamily") or self.intent_family(best_intent)
        row["secondMoveIntentFamily"] = row.get("secondMoveIntentFamily") or self.intent_family(second_intent)
        row["thirdMoveIntentFamily"] = row.get("thirdMoveIntentFamily") or self.intent_family(third_intent)

        for key in (
            "moveNumber",
            "gapTop2Cp",
            "gapTop3Cp",
            "playedMoveEvalCp",
            "bestEvalCp",
            "secondEvalCp",
            "thirdEvalCp",
            "riskScore",
            "complexityScore",
            "forcingScore",
            "safetyScore",
            "playedMoveRank",
            "playerRating",
        ):
            row[key] = self._to_int(row.get(key))

        row["playerRating"] = row["playerRating"] if row["playerRating"] is not None else raw.get("playerRating", "")
        row["engineIntents"] = [best_intent, second_intent, third_intent]
        row["engineIntentFamilies"] = [
            row["bestMoveIntentFamily"],
            row["secondMoveIntentFamily"],
            row["thirdMoveIntentFamily"],
        ]
        return row

    @staticmethod
    def _build_position_id(row: dict[str, Any]) -> str:
        game_id = str(row.get("gameIdFull") or row.get("gameId") or "game")
        player_name = str(row.get("playerName") or "player")
        color = "w" if str(row.get("playerColor")) == "White" else "b"
        move_number = str(row.get("moveNumber") or "0")
        played_move = str(row.get("playedMoveUci") or "move")
        safe_game = "".join(ch.lower() for ch in game_id if ch.isalnum())[-10:] or "game"
        safe_player = "".join(ch.lower() for ch in player_name if ch.isalnum())[:12] or "player"
        return f"pos_{safe_game}_{safe_player}_{move_number}{color}_{played_move}"

    @staticmethod
    def intent_family(intent: str) -> str:
        if intent in {"material_gain", "material_safety", "trade", "avoid_trade"}:
            return "material"
        if intent in {"central_control", "space_gain"}:
            return "space"
        if intent in {"king_safety", "defense", "prophylaxis"}:
            return "king_safety"
        if intent in {"pawn_break"}:
            return "pawn_structure"
        return "piece_activity"

    @staticmethod
    def _to_int(value: Any) -> int | None:
        if value in ("", None):
            return None
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    @staticmethod
    def _write_json(path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    @lru_cache(maxsize=1)
    def _load_persona_dashboard(self) -> dict[str, Any]:
        text = self.persona_dashboard_path.read_text(encoding="utf-8")
        cleaned = re.sub(r"^window\.PERSONA_DASHBOARD_DATA\s*=\s*", "", text.strip())
        cleaned = cleaned.rstrip(";")
        return json.loads(cleaned)

    def _extract_games(self, pgn_text: str) -> list[dict[str, Any]]:
        blocks: list[str] = []
        matches = list(re.finditer(r"(?m)^\[Event\s+\"", pgn_text))
        if matches:
            for index, match in enumerate(matches):
                start = match.start()
                end = matches[index + 1].start() if index + 1 < len(matches) else len(pgn_text)
                blocks.append(pgn_text[start:end].strip())
        elif pgn_text:
            blocks.append(pgn_text)

        games: list[dict[str, Any]] = []
        for block in blocks:
            headers: dict[str, str] = {}
            for key, value in re.findall(r'^\[(\w+)\s+"(.*)"\]$', block, flags=re.MULTILINE):
                headers[key] = value
            games.append({"headers": headers, "text": block})
        return games

    def _summarize_games(
        self,
        games: list[dict[str, Any]],
        batch_size: int,
        run_id: str,
        run_name: str | None,
        created_at: str,
    ) -> dict[str, Any]:
        player_samples: list[dict[str, Any]] = []
        eligible_games = 0
        missing_rating_games = 0

        for game in games:
            headers = game["headers"]
            white_elo = self._to_int(headers.get("WhiteElo"))
            black_elo = self._to_int(headers.get("BlackElo"))
            white_in_range = white_elo is not None and 0 <= white_elo <= 1400
            black_in_range = black_elo is not None and 0 <= black_elo <= 1400
            if white_in_range or black_in_range:
                eligible_games += 1
            elif white_elo is None or black_elo is None:
                missing_rating_games += 1

            if len(player_samples) < 8:
                player_samples.append(
                    {
                        "white": headers.get("White", "Unknown"),
                        "black": headers.get("Black", "Unknown"),
                        "whiteElo": headers.get("WhiteElo", ""),
                        "blackElo": headers.get("BlackElo", ""),
                        "event": headers.get("Event", ""),
                    }
                )

        game_count = len(games)
        estimated_batches = max(1, (game_count + batch_size - 1) // batch_size) if game_count else 0
        return {
            "runId": run_id,
            "runName": (run_name or "").strip() or f"PGN upload {run_id[-6:]}",
            "status": "prepared",
            "message": "PGN uploaded and split into batches. Hook the engine pipeline to turn this prepared run into full decision analysis.",
            "createdAt": created_at,
            "gameCount": game_count,
            "eligibleGames": eligible_games,
            "missingRatingGames": missing_rating_games,
            "batchSize": batch_size,
            "estimatedBatchCount": estimated_batches,
            "playerSamples": player_samples,
        }

    def _build_research_topics(self, rows: list[dict[str, Any]], topic_count: int) -> list[dict[str, Any]]:
        if not rows:
            return []

        def any_intent(row: dict[str, Any], values: set[str]) -> bool:
            return bool({row.get("effectiveIntent"), row.get("bestMoveIntent"), row.get("secondMoveIntent"), row.get("thirdMoveIntent")} & values)

        def any_family(row: dict[str, Any], values: set[str]) -> bool:
            families = {row.get("effectiveIntentFamily"), *(row.get("engineIntentFamilies") or [])}
            return bool(families & values)

        catalog: list[tuple[str, str, str, Callable[[dict[str, Any]], bool]]] = [
            (
                "cct_scan",
                "Checks, captures, threats before anything else",
                "These positions repeatedly ask for a concrete scan first, especially when one forcing move changes the whole evaluation.",
                lambda row: any_intent(row, {"attack", "tactical_calculation"}),
            ),
            (
                "quiet_improvement",
                "Do not miss the quiet move that improves everything",
                "A recurring theme is that the best move is often useful and calm rather than flashy.",
                lambda row: any_intent(row, {"quiet_improvement", "piece_activity", "development"}),
            ),
            (
                "trade_judgment",
                "Trade only when it actually helps your position",
                "Many equal-choice moments turn on whether to keep tension, trade, or win material without giving too much back.",
                lambda row: any_intent(row, {"trade", "avoid_trade", "material_gain", "material_safety"}),
            ),
            (
                "space_and_center",
                "Central moves matter more than side moves",
                "The dataset keeps surfacing positions where center and space decisions shape the whole plan.",
                lambda row: any_intent(row, {"central_control", "space_gain"}) or any_family(row, {"space"}),
            ),
            (
                "pawn_break_timing",
                "Know when to push, when to wait, and when to take",
                "Pawn breaks appear as real decision moments here, so timing matters more than automatic pawn pushes.",
                lambda row: any_intent(row, {"pawn_break"}),
            ),
            (
                "king_safety",
                "Before defending, check if the threat is real",
                "A lot of practical positions ask whether to defend, stabilize, or trust that nothing urgent is happening yet.",
                lambda row: any_family(row, {"king_safety"}) or any_intent(row, {"king_safety", "defense", "prophylaxis"}),
            ),
            (
                "piece_coordination",
                "Improve the worst piece before starting a plan",
                "These moments often reward better coordination instead of forcing action too early.",
                lambda row: any_intent(row, {"development", "piece_activity"}),
            ),
            (
                "quiet_vs_forcing",
                "Choose between the forcing move and the useful move",
                "Several positions are really about whether to act now or improve first.",
                lambda row: row.get("decisionType") in {"quiet_vs_forcing", "technical_vs_dynamic"},
            ),
            (
                "endgame_technique",
                "Equal endings still need a plan",
                "A lot of low-risk decisions in this bank come from technical endings where the right improving move matters.",
                lambda row: any_intent(row, {"endgame_technical"}),
            ),
            (
                "candidate_discipline",
                "Do not stop at the first move that looks playable",
                "Because these are equal-choice positions, the training value is in comparing at least two sensible moves before choosing one.",
                lambda row: True,
            ),
            (
                "material_vs_activity",
                "Material versus activity is a repeat practical choice",
                "These positions keep asking whether a capture is really better than piece activity or initiative.",
                lambda row: row.get("decisionType") == "material_vs_activity" or any_family(row, {"material", "piece_activity"}),
            ),
            (
                "practical_defense",
                "When worse, make the position playable first",
                "The practical skill here is finding a move that reduces danger and keeps the game alive.",
                lambda row: row.get("personaSignal") in {"Defender", "Safety-First"} or any_intent(row, {"defense", "king_safety"}),
            ),
        ]

        topics: list[dict[str, Any]] = []
        for topic_id, title, description, matcher in catalog:
            matches = [row for row in rows if matcher(row)]
            if not matches:
                continue
            share = round((len(matches) / len(rows)) * 100)
            sample_rows = matches[:3]
            topics.append(
                {
                    "id": topic_id,
                    "title": title,
                    "description": description,
                    "signalCount": len(matches),
                    "sharePct": share,
                    "examples": [
                        {
                            "positionId": row.get("positionId"),
                            "playerName": row.get("playerName"),
                            "move": row.get("playedMoveSan"),
                            "engineMove": row.get("bestMoveSan"),
                        }
                        for row in sample_rows
                    ],
                    "whyItFits": self._topic_reason(topic_id, sample_rows[0] if sample_rows else None),
                }
            )

        topics.sort(key=lambda item: (-item["signalCount"], item["title"]))
        return topics[:topic_count]

    @staticmethod
    def _topic_reason(topic_id: str, row: dict[str, Any] | None) -> str:
        if not row:
            return "Generated from repeated equal-choice positions."
        player = row.get("playerName") or "This player"
        move = row.get("playedMoveSan") or "the played move"
        best = row.get("bestMoveSan") or "the engine move"
        reasons = {
            "cct_scan": f"{player} repeatedly reaches positions like {move} versus {best}, where forcing details should be compared first.",
            "quiet_improvement": f"Positions like {move} versus {best} reward a calm improving move instead of an automatic active one.",
            "trade_judgment": f"This theme appears when {player} must judge whether {move} or {best} handles material and exchanges better.",
            "space_and_center": f"The dataset includes central and space choices where {move} and {best} lead to very different long-term plans.",
            "pawn_break_timing": f"These examples show that a pawn move like {move} is only good when the timing really works.",
            "king_safety": f"This cluster comes from positions where {player} has to decide whether safety or activity matters more right now.",
            "piece_coordination": f"Examples like {move} versus {best} suggest the key lesson is often piece placement before action.",
            "quiet_vs_forcing": f"The practical choice in these moments is whether to force matters with {move} or improve first with {best}.",
            "endgame_technique": f"The ending examples here show that even equal positions still need accurate improving moves.",
            "candidate_discipline": f"Because {move} and {best} are both playable at first glance, this topic trains better candidate comparison.",
            "material_vs_activity": f"These moments often ask whether immediate material or better activity should come first.",
            "practical_defense": f"This topic comes from positions where staying solid is more useful than chasing something optimistic.",
        }
        return reasons.get(topic_id, "Generated from repeated equal-choice positions.")
