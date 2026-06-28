from __future__ import annotations

import csv
import json
from functools import lru_cache
from pathlib import Path
from typing import Any


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

    def get_dashboard_payload(self) -> dict[str, Any]:
        return {
            "overview": self.get_overview(),
            "players": self.get_players(),
            "decisions": self.get_decisions(),
            "overrides": self.get_overrides(),
            "intentOptions": INTENT_OPTIONS,
            "intentFamilies": INTENT_FAMILIES,
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

    def stub_analyze(self, pgn: str, batch_size: int) -> dict[str, Any]:
        return {
            "status": "not_implemented",
            "message": "Live PGN analysis is not wired yet. The app is serving the existing decision dataset first.",
            "batchSize": batch_size,
            "pgnPreview": pgn[:120],
        }

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
