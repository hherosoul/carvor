import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Optional

from app.core.database import async_session

logger = logging.getLogger("carvor.vector_search")

LOCAL_MODEL_PATH = Path(__file__).resolve().parent.parent.parent / "models" / "bge-small-zh-v1.5"
VECTOR_STORE_DIR = Path(os.environ.get("CARVOR_DATA_DIR", "data")) / "vector_store"
DOC_MAP_PATH = VECTOR_STORE_DIR / "doc_map.json"

_vector_service: Optional["VectorSearchService"] = None


class VectorSearchService:
    def __init__(self):
        self._embed_model = None
        self._index = None
        self._doc_map: dict[int, dict] = {}
        self._initialized = False
        self._index_loaded = False

    def _ensure_init(self):
        if self._initialized:
            return
        self._initialized = True
        try:
            from llama_index.embeddings.huggingface import HuggingFaceEmbedding

            model_path = str(LOCAL_MODEL_PATH)
            if not LOCAL_MODEL_PATH.exists():
                logger.warning(f"Local model not found at {model_path}, vector search disabled")
                return

            logger.info(f"Loading local embedding model: {model_path}")
            self._embed_model = HuggingFaceEmbedding(model_name=model_path)
            logger.info("Embedding model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load embedding model: {e}")
            self._embed_model = None

    def _load_persisted_index_sync(self):
        self._ensure_init()
        if not self._embed_model:
            return False

        return self._load_index_only()

    def _load_index_only(self):
        if self._index_loaded:
            return True

        try:
            from llama_index.core import StorageContext, load_index_from_storage

            if not VECTOR_STORE_DIR.exists():
                return False

            required_files = ["docstore.json", "index_store.json", "default__vector_store.json"]
            if not all((VECTOR_STORE_DIR / f).exists() for f in required_files):
                return False

            logger.info("Loading persisted vector index")
            storage_context = StorageContext.from_defaults(persist_dir=str(VECTOR_STORE_DIR))
            self._index = load_index_from_storage(storage_context, embed_model=self._embed_model)
            self._index_loaded = True
            logger.info("Persisted vector index loaded successfully")
            return True
        except Exception as e:
            logger.warning(f"Failed to load persisted index: {e}")
            return False

    def _load_doc_map(self):
        if DOC_MAP_PATH.exists():
            try:
                data = json.loads(DOC_MAP_PATH.read_text(encoding="utf-8"))
                self._doc_map = {int(k): v for k, v in data.items()}
                logger.info(f"Loaded doc_map with {len(self._doc_map)} entries")
            except Exception as e:
                logger.warning(f"Failed to load doc_map: {e}")
                self._doc_map = {}

    def _save_doc_map(self):
        try:
            VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
            data = {str(k): v for k, v in self._doc_map.items()}
            DOC_MAP_PATH.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            logger.warning(f"Failed to save doc_map: {e}")

    def _build_index_sync(self, papers: list[dict]):
        self._ensure_init()
        if not self._embed_model:
            return

        try:
            from llama_index.core import Document, VectorStoreIndex, StorageContext
            from llama_index.core.storage.docstore import SimpleDocumentStore
            from llama_index.core.storage.index_store import SimpleIndexStore
            from llama_index.core.vector_stores import SimpleVectorStore

            VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)

            documents = []
            for p in papers:
                pid = p.get("id")
                title = p.get("title", "")
                abstract = p.get("abstract", "") or p.get("structured_summary", "")
                keywords = p.get("keywords", [])
                kw_text = ", ".join(keywords) if isinstance(keywords, list) else str(keywords)
                text = f"标题: {title}\n关键词: {kw_text}\n摘要: {abstract}"
                documents.append(Document(text=text, metadata={"paper_id": pid, "title": title}))
                self._doc_map[pid] = p

            if not documents:
                return

            logger.info(f"Building vector index for {len(documents)} papers")
            storage_context = StorageContext.from_defaults(
                docstore=SimpleDocumentStore(),
                vector_store=SimpleVectorStore(),
                index_store=SimpleIndexStore(),
            )
            self._index = VectorStoreIndex.from_documents(
                documents, storage_context=storage_context, embed_model=self._embed_model, show_progress=False,
            )
            self._index.storage_context.persist(persist_dir=str(VECTOR_STORE_DIR))
            self._index_loaded = True
            self._save_doc_map()
            logger.info("Vector index built and persisted")
        except Exception as e:
            logger.warning(f"Failed to build vector index: {e}")
            self._index = None

    async def build_index(self, papers: list[dict]):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._build_index_sync, papers)

    async def rebuild_index_from_db(self, session):
        from sqlalchemy import select
        from app.models.database import Paper, PaperLibraryAssoc

        result = await session.execute(
            select(Paper).join(PaperLibraryAssoc, PaperLibraryAssoc.paper_id == Paper.id)
        )
        all_papers = result.scalars().all()

        papers_data = [{
            "id": p.id,
            "title": p.title,
            "authors": json.loads(p.authors) if p.authors else [],
            "abstract": p.abstract or "",
            "structured_summary": p.structured_summary or "",
            "keywords": json.loads(p.keywords) if p.keywords else [],
        } for p in all_papers]

        if papers_data:
            await self.build_index(papers_data)
            logger.info(f"Rebuilt vector index from DB with {len(papers_data)} papers")

    async def add_paper(self, paper_data: dict, session):
        self._ensure_init()
        if not self._embed_model:
            return

        pid = paper_data.get("id")
        if not pid:
            return

        self._doc_map[pid] = paper_data

        if not self._index_loaded:
            if not self._load_persisted_index_sync():
                await self.rebuild_index_from_db(session)
                return

        try:
            from llama_index.core import Document

            title = paper_data.get("title", "")
            abstract = paper_data.get("abstract", "") or paper_data.get("structured_summary", "")
            keywords = paper_data.get("keywords", [])
            kw_text = ", ".join(keywords) if isinstance(keywords, list) else str(keywords)
            text = f"标题: {title}\n关键词: {kw_text}\n摘要: {abstract}"
            doc = Document(text=text, metadata={"paper_id": pid, "title": title})

            self._index.insert(doc, embed_model=self._embed_model)
            self._index.storage_context.persist(persist_dir=str(VECTOR_STORE_DIR))
            self._save_doc_map()
            logger.info(f"Added paper {pid} to vector index")
        except Exception as e:
            logger.warning(f"Failed to add paper to index, rebuilding: {e}")
            await self.rebuild_index_from_db(session)

    def _search_sync(self, query: str, top_k: int, similarity_cutoff: Optional[float] = None) -> list[dict]:
        self._ensure_init()
        if not self._embed_model:
            return []

        if not self._index_loaded:
            self._load_persisted_index_sync()

        if not self._index:
            return []

        if not self._doc_map:
            self._load_doc_map()

        try:
            if similarity_cutoff is not None:
                retriever = self._index.as_retriever(similarity_top_k=top_k, similarity_cutoff=similarity_cutoff)
            else:
                retriever = self._index.as_retriever(similarity_top_k=top_k)
            nodes = retriever.retrieve(query)

            results = []
            seen = set()
            for node in nodes:
                pid = node.node.metadata.get("paper_id")
                if pid and pid not in seen:
                    seen.add(pid)
                    paper_data = self._doc_map.get(pid, {})
                    results.append({
                        "id": pid,
                        "title": node.node.metadata.get("title", ""),
                        "authors": paper_data.get("authors", []),
                        "abstract": paper_data.get("abstract", ""),
                        "structured_summary": paper_data.get("structured_summary", ""),
                        "score": getattr(node, "score", None),
                    })
            return results[:top_k]
        except Exception as e:
            logger.warning(f"Vector search failed: {e}")
            return []

    def _remove_paper_sync(self, paper_id: int):
        if not self._doc_map:
            self._load_doc_map()
        self._doc_map.pop(paper_id, None)
        self._save_doc_map()

        if not self._index_loaded:
            self._load_index_only()

        if not self._index:
            return

        try:
            docstore = self._index.docstore
            docs_to_delete = []
            for doc_id, node in docstore.docs.items():
                if getattr(node, 'metadata', {}).get('paper_id') == paper_id:
                    docs_to_delete.append(doc_id)

            if docs_to_delete:
                for doc_id in docs_to_delete:
                    self._index.delete_ref_doc(doc_id, delete_from_docstore=True)
                self._index.storage_context.persist(persist_dir=str(VECTOR_STORE_DIR))
                logger.info(f"Removed paper {paper_id} from vector index ({len(docs_to_delete)} nodes)")
            else:
                logger.info(f"No vector nodes found for paper {paper_id}, skipping removal")
        except Exception as e:
            logger.warning(f"Failed to remove paper from index: {e}")
            self._index = None
            self._index_loaded = False

    async def remove_paper(self, paper_id: int):
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._remove_paper_sync, paper_id)

    async def search(self, query: str, top_k: int = 5, similarity_cutoff: Optional[float] = None) -> list[dict]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._search_sync, query, top_k, similarity_cutoff)


def get_vector_service() -> VectorSearchService:
    global _vector_service
    if _vector_service is None:
        _vector_service = VectorSearchService()
    return _vector_service
