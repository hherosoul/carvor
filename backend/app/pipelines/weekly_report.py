from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.database import PaperLibrary, Paper, PaperLibraryAssoc
from app.gateway.llm_gateway import gateway


async def generate_weekly_report(
    library_id: int,
    week_start: str,
    week_end: str,
    session: AsyncSession,
) -> str:
    result = await session.execute(
        select(PaperLibrary).where(PaperLibrary.id == library_id)
    )
    library = result.scalar_one_or_none()
    if not library:
        raise ValueError(f"Paper library {library_id} not found")

    result = await session.execute(
        select(Paper)
        .join(PaperLibraryAssoc, PaperLibraryAssoc.paper_id == Paper.id)
        .where(PaperLibraryAssoc.library_id == library_id)
        .where(Paper.published_date >= week_start)
        .where(Paper.published_date <= week_end)
        .limit(30)
    )
    papers = result.scalars().all()

    if not papers:
        return "本周无新论文。"

    paper_list = []
    for p in papers:
        paper_list.append({
            "title": p.title,
            "authors": p.authors or "",
            "summary": p.structured_summary or p.abstract or "",
        })

    llm_result = await gateway.call_async("weekly_report", {
        "domain_description": library.domain_description,
        "papers": paper_list,
        "week_start": week_start,
    })

    return llm_result.get("report", llm_result.get("raw", ""))
