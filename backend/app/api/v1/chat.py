import json
import logging
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from openai import AsyncOpenAI

from app.core.database import get_session
from app.models.database import LLMProviderConfig
from app.pipelines.deep_reading import chat_deep_reading
from app.pipelines.idea import chat_idea
from app.pipelines.review import discuss_review
from app.pipelines.method import discuss_method
from app.pipelines.prompt_doc import generate_prompt_doc
from app.pipelines.polish import polish_paper

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger("carvor.chat")


class ChatRequest(BaseModel):
    scenario: str
    entity_id: int
    user_input: str
    conversation_id: int | None = None
    existing_content: str = ""


def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def chat_stream(req: ChatRequest, session: AsyncSession = Depends(get_session)):
    async def generate():
        try:
            stream = None
            conv_id = None

            if req.scenario == "deep_reading":
                stream, conv_id = await chat_deep_reading(
                    paper_id=req.entity_id,
                    question=req.user_input,
                    conversation_id=req.conversation_id,
                    session=session,
                )
            elif req.scenario in ("idea_refine", "idea"):
                stream = await chat_idea(
                    idea_id=req.entity_id,
                    user_input=req.user_input,
                    conversation_id=req.conversation_id,
                    session=session,
                )
            elif req.scenario == "review":
                stream, conv_id = await discuss_review(
                    task_id=req.entity_id,
                    user_input=req.user_input,
                    conversation_id=req.conversation_id,
                    existing_content=req.existing_content,
                    session=session,
                )
            elif req.scenario == "method":
                stream, conv_id = await discuss_method(
                    task_id=req.entity_id,
                    user_input=req.user_input,
                    conversation_id=req.conversation_id,
                    existing_content=req.existing_content,
                    session=session,
                )
            elif req.scenario == "prompt_doc":
                stream, conv_id = await generate_prompt_doc(
                    task_id=req.entity_id,
                    user_input=req.user_input,
                    conversation_id=req.conversation_id,
                    existing_content=req.existing_content,
                    session=session,
                )
            elif req.scenario == "polish":
                stream, conv_id = await polish_paper(
                    task_id=req.entity_id,
                    original_text=req.user_input,
                    conversation_id=req.conversation_id,
                    existing_content=req.existing_content,
                    session=session,
                )
            else:
                yield _sse_event("error", {"message": f"Unknown scenario: {req.scenario}"})
                return

            if conv_id:
                yield _sse_event("conversation.created", {"conversation_id": conv_id})

            if stream:
                async for chunk in stream:
                    yield _sse_event("chunk", {"content": chunk})

            yield _sse_event("done", {})

        except Exception as e:
            logger.error(f"Chat stream error: {e}")
            yield _sse_event("error", {"message": str(e)})

    return StreamingResponse(generate(), media_type="text/event-stream")


PRESET_MODELS = [
    {"name": "DeepSeek", "base_url": "https://api.deepseek.com/v1", "model": "deepseek-chat"},
    {"name": "Moonshot", "base_url": "https://api.moonshot.cn/v1", "model": "kimi-k2.6"},
    {"name": "OpenAI", "base_url": "https://api.openai.com/v1", "model": "gpt-4o"},
    {"name": "ZhipuAI", "base_url": "https://open.bigmodel.cn/api/paas/v4", "model": "glm-4-plus"},
    {"name": "Qwen", "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "model": "qwen-plus"},
]


@router.get("/preset-models")
async def get_preset_models():
    return PRESET_MODELS


def _extract_file_text(content: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("txt", "md"):
        return content.decode("utf-8", errors="replace")
    elif ext == "pdf":
        try:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
            return text
        except Exception as e:
            return f"[PDF解析失败: {e}]"
    elif ext == "docx":
        try:
            from docx import Document
            from io import BytesIO
            doc = Document(BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            return f"[DOCX解析失败: {e}]"
    return f"[不支持的文件格式: {ext}]"


@router.post("/custom-stream")
async def custom_model_chat_stream(
    user_input: str = Form(...),
    provider_id: Optional[int] = Form(None),
    custom_base_url: Optional[str] = Form(None),
    custom_api_key: Optional[str] = Form(None),
    custom_model: Optional[str] = Form(None),
    files: list[UploadFile] = File(default=[]),
    session: AsyncSession = Depends(get_session),
):
    base_url = ""
    api_key = ""
    model = ""

    if provider_id:
        result = await session.execute(select(LLMProviderConfig).where(LLMProviderConfig.id == provider_id))
        provider = result.scalar_one_or_none()
        if not provider:
            return StreamingResponse(
                iter([_sse_event("error", {"message": "Provider not found"})]),
                media_type="text/event-stream",
            )
        base_url = provider.base_url
        api_key = provider.api_key
        model = provider.model
    elif custom_base_url and custom_api_key and custom_model:
        base_url = custom_base_url
        api_key = custom_api_key
        model = custom_model
    else:
        return StreamingResponse(
            iter([_sse_event("error", {"message": "请选择模型或提供自定义配置"})]),
            media_type="text/event-stream",
        )

    file_contents = []
    for f in files:
        content = await f.read()
        text = _extract_file_text(content, f.filename or "")
        file_contents.append({"filename": f.filename, "content": text})

    async def generate():
        try:
            client = AsyncOpenAI(base_url=base_url, api_key=api_key)

            messages = [
                {"role": "system", "content": "你是一个研究助手，帮助用户锤炼和讨论研究想法。请基于用户提供的上下文和附件内容进行讨论。"},
            ]

            if file_contents:
                file_parts = []
                for fc in file_contents:
                    file_parts.append(f"--- 附件: {fc['filename']} ---\n{fc['content']}\n--- 附件结束 ---")
                messages.append({"role": "user", "content": f"我上传了以下附件供参考：\n\n{''.join(file_parts)}"})

            messages.append({"role": "user", "content": user_input})

            kwargs: dict = {
                "model": model,
                "messages": messages,
                "max_tokens": 32768,
                "stream": True,
            }

            stream = await client.chat.completions.create(**kwargs)
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield _sse_event("chunk", {"content": chunk.choices[0].delta.content})

            yield _sse_event("done", {})

        except Exception as e:
            logger.error(f"Custom model chat error: {e}")
            yield _sse_event("error", {"message": str(e)})

    return StreamingResponse(generate(), media_type="text/event-stream")
