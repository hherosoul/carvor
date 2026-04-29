import asyncio
import json
import logging
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from app.core.database import get_session
from app.models.database import Paper, PaperLibraryAssoc, PaperLibrary, PaperNote, TaskReference
from app.pipelines.paper_search import search_pipelines
from app.pipelines.paper_import import import_pdf
from app.pipelines.deep_reading import start_deep_reading, chat_deep_reading, summarize_deep_reading
from app.gateway.llm_gateway import gateway
from app.services.vector_search import get_vector_service

logger = logging.getLogger("carvor.papers")

router = APIRouter(prefix="/api/papers", tags=["papers"])


class OnDemandSearchRequest(BaseModel):
    task_description: str
    days: int = 3
    max_papers: int = 10


class OptimizeQueryRequest(BaseModel):
    query: str


@router.post("/optimize-query")
async def optimize_query(data: OptimizeQueryRequest):
    try:
        result = await gateway.call_async("optimize_query", {
            "original_query": data.query,
        })
        return {"optimized_query": result.get("optimized_query", data.query)}
    except Exception as e:
        logger.warning(f"Query optimization failed: {e}")
        return {"optimized_query": data.query}


@router.get("")
async def list_papers(
    library_id: int = Query(...),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    query = (
        select(Paper, PaperLibraryAssoc)
        .join(PaperLibraryAssoc, PaperLibraryAssoc.paper_id == Paper.id)
        .where(PaperLibraryAssoc.library_id == library_id)
        .order_by(Paper.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
    )
    result = await session.execute(query)
    rows = result.all()
    return [{
        "id": p.id,
        "title": p.title,
        "authors": json.loads(p.authors) if p.authors else [],
        "institution": p.institution,
        "abstract": p.abstract,
        "structured_summary": p.structured_summary,
        "keywords": json.loads(p.keywords) if p.keywords else [],
        "source": p.source,
        "published_date": p.published_date,
        "source_url": p.source_url,
        "is_read": a.is_read,
        "is_interested": a.is_interested,
        "deep_reading_summary": p.deep_reading_summary,
    } for p, a in rows]


@router.get("/{paper_id}")
async def get_paper(paper_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(404, "Paper not found")
    return {
        "id": paper.id,
        "title": paper.title,
        "authors": json.loads(paper.authors) if paper.authors else [],
        "institution": paper.institution,
        "abstract": paper.abstract,
        "structured_summary": paper.structured_summary,
        "keywords": json.loads(paper.keywords) if paper.keywords else [],
        "source": paper.source,
        "published_date": paper.published_date,
        "source_url": paper.source_url,
        "pdf_path": paper.pdf_path,
        "deep_reading_summary": paper.deep_reading_summary,
    }


@router.post("/import")
async def import_paper(
    library_id: int = Query(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
):
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        paper = await import_pdf(library_id, tmp_path, session)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"论文导入失败：{str(e)}")

    vs = get_vector_service()
    try:
        paper_data = {
            "id": paper.id,
            "title": paper.title,
            "authors": json.loads(paper.authors) if paper.authors else [],
            "abstract": paper.abstract or "",
            "structured_summary": paper.structured_summary or "",
            "keywords": json.loads(paper.keywords) if paper.keywords else [],
        }
        asyncio.create_task(vs.add_paper(paper_data, session))
        logger.info(f"Triggered RAG indexing for imported paper {paper.id}")
    except Exception as e:
        logger.warning(f"Failed to trigger RAG indexing for imported paper: {e}")

    return {"id": paper.id, "title": paper.title}


@router.post("/{paper_id}/download")
async def download_paper(paper_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(404, "Paper not found")
    if paper.pdf_path:
        return {"status": "already_downloaded", "pdf_path": paper.pdf_path}
    return {"status": "manual_download_required", "source_url": paper.source_url}


@router.post("/{paper_id}/read")
async def mark_read(paper_id: int, library_id: int = Query(...), session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(PaperLibraryAssoc).where(
            PaperLibraryAssoc.paper_id == paper_id,
            PaperLibraryAssoc.library_id == library_id,
        )
    )
    assoc = result.scalar_one_or_none()
    if not assoc:
        raise HTTPException(404, "Paper not in library")
    assoc.is_read = 1
    session.add(assoc)
    await session.commit()
    return {"ok": True}


@router.post("/{paper_id}/interest")
async def mark_interest(paper_id: int, library_id: int = Query(...), session: AsyncSession = Depends(get_session)):
    result = await session.execute(
        select(PaperLibraryAssoc).where(
            PaperLibraryAssoc.paper_id == paper_id,
            PaperLibraryAssoc.library_id == library_id,
        )
    )
    assoc = result.scalar_one_or_none()
    if not assoc:
        raise HTTPException(404, "Paper not in library")
    assoc.is_interested = 0 if assoc.is_interested == 1 else 1
    session.add(assoc)
    await session.commit()
    return {"ok": True, "is_interested": assoc.is_interested}


@router.delete("/{paper_id}")
async def delete_paper(paper_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(Paper).where(Paper.id == paper_id))
    paper = result.scalar_one_or_none()
    if not paper:
        raise HTTPException(404, "Paper not found")

    vs = get_vector_service()
    try:
        asyncio.create_task(vs.remove_paper(paper_id))
    except Exception as e:
        logger.warning(f"Failed to trigger RAG removal for paper {paper_id}: {e}")

    await session.execute(delete(PaperLibraryAssoc).where(PaperLibraryAssoc.paper_id == paper_id))
    await session.execute(delete(PaperNote).where(PaperNote.paper_id == paper_id))
    await session.execute(delete(TaskReference).where(TaskReference.paper_id == paper_id))
    await session.delete(paper)
    await session.commit()
    return {"ok": True}


@router.post("/search")
async def on_demand_search(data: OnDemandSearchRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(PaperLibrary).limit(1))
    library = result.scalar_one_or_none()
    if not library:
        library = PaperLibrary(name="默认论文库", domain_description="")
        session.add(library)
        await session.flush()

    progress_events: list[dict] = []

    async def progress_callback(step: str, round: int, message: str):
        progress_events.append({"step": step, "round": round, "message": message})

    today = datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d")
    cutoff_date = (datetime.now(timezone(timedelta(hours=8))) - timedelta(days=data.days)).strftime("%Y-%m-%d")

    try:
        llm_result = await gateway.call_async("on_demand_search", {
            "query": data.task_description,
            "domain_description": library.domain_description,
            "days": data.days,
            "max_papers": data.max_papers,
            "today": today,
            "cutoff_date": cutoff_date,
        }, progress_callback=progress_callback)
    except Exception as e:
        raise HTTPException(500, f"LLM调用失败：{str(e)}")

    papers_data = llm_result.get("papers", [])
    logger.info(f"On-demand search returned {len(papers_data)} papers, llm_result keys: {list(llm_result.keys())}")
    if not papers_data and "raw" in llm_result:
        logger.warning(f"On-demand search got raw response instead of structured data: {str(llm_result['raw'])[:300]}")

    filtered = []
    for p in papers_data[:data.max_papers]:
        published_date = p.get("published_date", "")
        if not published_date:
            logger.info(f"Skipping paper without published_date: {p.get('title', 'unknown')}")
            continue
        try:
            pub_dt = datetime.strptime(published_date[:10], "%Y-%m-%d")
            cutoff_dt = datetime.strptime(cutoff_date, "%Y-%m-%d")
            if pub_dt < cutoff_dt:
                logger.info(f"Skipping old paper ({published_date}): {p.get('title', 'unknown')}")
                continue
        except (ValueError, IndexError):
            logger.info(f"Skipping paper with invalid date ({published_date}): {p.get('title', 'unknown')}")
            continue
        filtered.append(p)

    saved = []
    for p in filtered:
        existing = await session.execute(
            select(Paper).where(
                Paper.title == p.get("title", ""),
                Paper.source_url == p.get("source_url", ""),
            )
        )
        if existing.scalar_one_or_none():
            continue
        paper = Paper(
            title=p.get("title", ""),
            authors=json.dumps(p.get("authors", []), ensure_ascii=False),
            institution=p.get("institution", ""),
            abstract=p.get("summary", p.get("abstract", "")),
            structured_summary=p.get("summary", ""),
            source="llm_search",
            published_date=p.get("published_date", ""),
            source_url=p.get("source_url", ""),
        )
        session.add(paper)
        await session.flush()

        assoc = PaperLibraryAssoc(paper_id=paper.id, library_id=library.id)
        session.add(assoc)
        saved.append({"id": paper.id, "title": paper.title, "summary": paper.structured_summary, "published_date": paper.published_date})
    await session.commit()

    vs = get_vector_service()
    for p in saved:
        try:
            paper_result = await session.execute(select(Paper).where(Paper.id == p["id"]))
            paper_obj = paper_result.scalar_one_or_none()
            if paper_obj:
                paper_data = {
                    "id": paper_obj.id,
                    "title": paper_obj.title,
                    "authors": json.loads(paper_obj.authors) if paper_obj.authors else [],
                    "abstract": paper_obj.abstract or "",
                    "structured_summary": paper_obj.structured_summary or "",
                    "keywords": json.loads(paper_obj.keywords) if paper_obj.keywords else [],
                }
                asyncio.create_task(vs.add_paper(paper_data, session))
                logger.info(f"Triggered RAG indexing for paper {paper_obj.id}")
        except Exception as e:
            logger.warning(f"Failed to trigger RAG indexing: {e}")

    return {"papers": saved, "progress": progress_events}


class SemanticSearchRequest(BaseModel):
    query: str
    library_id: int
    top_k: int = 5
    similarity_cutoff: Optional[float] = 0.6


@router.post("/semantic-search")
async def semantic_search(data: SemanticSearchRequest, session: AsyncSession = Depends(get_session)):
    logger.info(f"Semantic search: query='{data.query}', library_id={data.library_id}")

    vs = get_vector_service()
    vector_results = []
    try:
        vector_results = await vs.search(data.query, top_k=data.top_k, similarity_cutoff=data.similarity_cutoff)
        if not vector_results:
            result = await session.execute(
                select(Paper)
                .join(PaperLibraryAssoc, PaperLibraryAssoc.paper_id == Paper.id)
                .where(PaperLibraryAssoc.library_id == data.library_id)
            )
            all_papers = result.scalars().all()
            if all_papers:
                papers_data = [{
                    "id": p.id,
                    "title": p.title,
                    "authors": json.loads(p.authors) if p.authors else [],
                    "abstract": p.abstract or "",
                    "structured_summary": p.structured_summary or "",
                    "keywords": json.loads(p.keywords) if p.keywords else [],
                } for p in all_papers]
                await vs.build_index(papers_data)
                vector_results = await vs.search(data.query, top_k=data.top_k)
    except Exception as e:
        logger.warning(f"Vector search failed: {e}")

    logger.info(f"Vector search returned {len(vector_results)} results")
    return {"papers": vector_results, "method": "vector"}
