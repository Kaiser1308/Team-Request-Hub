from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.dashboard import DashboardSummaryOut
from app.schemas.users import CurrentUser
from app.services import dashboard

router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryOut)
async def get_dashboard_summary(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return dashboard.get_dashboard_summary(current_user)
