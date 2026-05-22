from pydantic import BaseModel

from app.schemas.requests import InternalRequestOut


class DashboardCounts(BaseModel):
    assigned: int
    created: int
    pool: int
    done: int
    urgent: int


class DashboardSummaryOut(BaseModel):
    counts: DashboardCounts
    assigned_recent: list[InternalRequestOut]
    created_recent: list[InternalRequestOut]
    pool_recent: list[InternalRequestOut]
    notifications_unread: int
