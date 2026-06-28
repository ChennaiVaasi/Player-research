from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from ..services.data_service import DataService


router = APIRouter(tags=["dashboard"])
service = DataService()


class OverridePayload(BaseModel):
    intent: str


class AnalyzeRequest(BaseModel):
    pgn: str
    batch_size: int = 20
    run_name: str | None = None


@router.get("/dashboard")
def get_dashboard() -> dict:
    return service.get_dashboard_payload()


@router.get("/persona-dashboard")
def get_persona_dashboard() -> dict:
    return service.get_persona_dashboard_payload()


@router.get("/research-dashboard")
def get_research_dashboard(
    player_id: str = Query("all", alias="playerId"),
    topic_count: int = Query(12, alias="topicCount"),
) -> dict:
    return service.get_research_dashboard(player_id, topic_count)


@router.get("/overview")
def get_overview() -> dict:
    return service.get_overview()


@router.get("/players")
def get_players() -> list[dict]:
    return service.get_players()


@router.get("/decisions")
def get_decisions() -> list[dict]:
    return service.get_decisions()


@router.get("/decisions/{position_id}")
def get_decision(position_id: str) -> dict:
    decision = service.get_decision(position_id)
    if not decision:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision


@router.get("/overrides")
def get_overrides() -> dict[str, str]:
    return service.get_overrides()


@router.post("/overrides/{position_id}")
def save_override(position_id: str, payload: OverridePayload) -> dict:
    return service.save_override(position_id, payload.intent)


@router.delete("/overrides/{position_id}")
def delete_override(position_id: str) -> dict:
    return service.delete_override(position_id)


@router.post("/analyze")
def analyze_pgn(payload: AnalyzeRequest) -> dict:
    return service.create_analysis_run(payload.pgn, payload.batch_size, payload.run_name)


@router.get("/analysis-runs")
def get_analysis_runs() -> list[dict]:
    return service.get_analysis_runs()
