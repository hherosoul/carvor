from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_session
from app.models.database import WeeklyReport
from app.pipelines.weekly_report import generate_weekly_report

router = APIRouter(prefix="/api/weekly-reports", tags=["weekly-reports"])


def _week_range_from_str(week_str: str) -> dict:
    try:
        parts = week_str.split("-W")
        year = int(parts[0])
        week_num = int(parts[1])
        jan1 = datetime(year, 1, 1)
        jan1_weekday = jan1.weekday()
        first_monday = jan1 + timedelta(days=(7 - jan1_weekday) % 7)
        if week_num == 0:
            start_of_week = jan1
        else:
            start_of_week = first_monday + timedelta(weeks=week_num - 1)
        end_of_week = start_of_week + timedelta(days=6)
        return {
            "week_start": start_of_week.strftime("%Y-%m-%d"),
            "week_end": end_of_week.strftime("%Y-%m-%d"),
            "week_start_short": start_of_week.strftime("%m-%d"),
            "week_end_short": end_of_week.strftime("%m-%d"),
        }
    except Exception:
        return {"week_start": "", "week_end": "", "week_start_short": "", "week_end_short": ""}


@router.get("")
async def list_weekly_reports(library_id: int = Query(...), session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(WeeklyReport)
        .where(WeeklyReport.library_id == library_id)
        .order_by(WeeklyReport.week_start.desc())
    )
    reports = result.scalars().all()
    return [
        {
            "id": r.id,
            "library_id": r.library_id,
            "week_start": r.week_start,
            "week_end": r.week_end,
            "content": r.content,
            "created_at": r.created_at,
        }
        for r in reports
    ]


@router.post("/{week}")
async def generate_weekly(
    week: str,
    library_id: int = Query(...),
    force: bool = Query(False),
    session: AsyncSession = Depends(get_session),
):
    wr = _week_range_from_str(week)
    week_start = wr["week_start"]
    week_end = wr["week_end"]

    existing = await session.execute(
        select(WeeklyReport).where(
            WeeklyReport.library_id == library_id,
            WeeklyReport.week_start == week_start,
        )
    )
    existing_reports = existing.scalars().all()
    if existing_reports and not force:
        r = existing_reports[0]
        return {
            "week": week,
            "week_start": week_start,
            "week_end": week_end,
            "report": r.content,
            "id": r.id,
            "created_at": r.created_at,
        }

    if existing_reports:
        for r in existing_reports:
            await session.delete(r)
        await session.commit()

    report_content = await generate_weekly_report(library_id, week_start, week_end, session)

    report = WeeklyReport(
        library_id=library_id,
        week_start=week_start,
        week_end=week_end,
        content=report_content,
    )
    session.add(report)
    await session.commit()

    return {
        "week": week,
        "week_start": week_start,
        "week_end": week_end,
        "report": report_content,
        "id": report.id,
        "created_at": report.created_at,
    }
