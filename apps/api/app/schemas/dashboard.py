from pydantic import BaseModel

from app.schemas.requests import InternalRequestOut


class DashboardCounts(BaseModel):
    assigned: int
    created: int
    pending: int
    done: int
    urgent: int


class DashboardSummaryOut(BaseModel):
    counts: DashboardCounts
    assigned_recent: list[InternalRequestOut]
    created_recent: list[InternalRequestOut]
    pending_recent: list[InternalRequestOut]
    notifications_unread: int
