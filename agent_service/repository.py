from datetime import UTC, datetime
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4

import aiosqlite

from agent_service.models import Conversation, RunRecord, RunStatus

DEFAULT_CONVERSATION_TITLE = "New conversation"


class ConversationRepository:
    def __init__(self, database_path: Path):
        self.database_path = Path(database_path)

    async def setup(self) -> None:
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        async with self._connect() as database:
            await database.executescript(
                """
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    canvas_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS conversations_canvas_updated
                    ON conversations(canvas_id, updated_at DESC);
                CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_active_per_canvas
                    ON conversations(canvas_id) WHERE is_active = 1;

                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
                    error_code TEXT,
                    started_at TEXT NOT NULL,
                    finished_at TEXT
                );
                CREATE INDEX IF NOT EXISTS runs_conversation_started
                    ON runs(conversation_id, started_at DESC);
                """
            )
            await database.commit()

    async def create_conversation(
        self, canvas_id: str, title: str = DEFAULT_CONVERSATION_TITLE
    ) -> Conversation:
        conversation_id = f"conv_{uuid4().hex}"
        now = _utc_now()
        async with self._connect() as database:
            await database.execute("BEGIN IMMEDIATE")
            await database.execute(
                "UPDATE conversations SET is_active = 0 WHERE canvas_id = ?",
                (canvas_id,),
            )
            await database.execute(
                """
                INSERT INTO conversations(id, canvas_id, title, is_active, created_at, updated_at)
                VALUES (?, ?, ?, 1, ?, ?)
                """,
                (conversation_id, canvas_id, title, now, now),
            )
            await database.commit()
        conversation = await self.get_conversation(conversation_id)
        if conversation is None:
            raise RuntimeError("Conversation insert did not persist")
        return conversation

    async def list_conversations(self, canvas_id: str) -> list[Conversation]:
        async with self._connect() as database:
            cursor = await database.execute(
                """
                SELECT * FROM conversations
                WHERE canvas_id = ?
                ORDER BY is_active DESC, updated_at DESC
                """,
                (canvas_id,),
            )
            return [_conversation_from_row(row) for row in await cursor.fetchall()]

    async def get_conversation(self, conversation_id: str) -> Conversation | None:
        async with self._connect() as database:
            cursor = await database.execute(
                "SELECT * FROM conversations WHERE id = ?", (conversation_id,)
            )
            row = await cursor.fetchone()
            return _conversation_from_row(row) if row else None

    async def activate_conversation(self, conversation_id: str) -> Conversation:
        async with self._connect() as database:
            cursor = await database.execute(
                "SELECT canvas_id FROM conversations WHERE id = ?", (conversation_id,)
            )
            row = await cursor.fetchone()
            if row is None:
                raise KeyError(conversation_id)
            now = _utc_now()
            await database.execute("BEGIN IMMEDIATE")
            await database.execute(
                "UPDATE conversations SET is_active = 0 WHERE canvas_id = ?", (row["canvas_id"],)
            )
            await database.execute(
                "UPDATE conversations SET is_active = 1, updated_at = ? WHERE id = ?",
                (now, conversation_id),
            )
            await database.commit()
        conversation = await self.get_conversation(conversation_id)
        if conversation is None:
            raise KeyError(conversation_id)
        return conversation

    async def update_title_from_first_message(self, conversation_id: str, message: str) -> None:
        title = " ".join(message.split())[:60]
        if not title:
            return
        async with self._connect() as database:
            await database.execute(
                """
                UPDATE conversations
                SET title = ?, updated_at = ?
                WHERE id = ? AND title = ?
                """,
                (title, _utc_now(), conversation_id, DEFAULT_CONVERSATION_TITLE),
            )
            await database.commit()

    async def start_run(self, conversation_id: str) -> RunRecord:
        if await self.get_conversation(conversation_id) is None:
            raise KeyError(conversation_id)
        run_id = f"run_{uuid4().hex}"
        started_at = _utc_now()
        async with self._connect() as database:
            await database.execute(
                """
                INSERT INTO runs(id, conversation_id, status, started_at)
                VALUES (?, ?, 'running', ?)
                """,
                (run_id, conversation_id, started_at),
            )
            await database.commit()
        return await self.get_run(run_id)

    async def get_run(self, run_id: str) -> RunRecord:
        async with self._connect() as database:
            cursor = await database.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
            row = await cursor.fetchone()
            if row is None:
                raise KeyError(run_id)
            return _run_from_row(row)

    async def finish_run(
        self, run_id: str, status: RunStatus, error_code: str | None = None
    ) -> None:
        if status == "running":
            raise ValueError("finish_run requires a terminal status")
        async with self._connect() as database:
            cursor = await database.execute(
                """
                UPDATE runs
                SET status = ?, error_code = ?, finished_at = ?
                WHERE id = ?
                """,
                (status, error_code, _utc_now(), run_id),
            )
            if cursor.rowcount == 0:
                raise KeyError(run_id)
            await database.commit()

    @asynccontextmanager
    async def _connect(self) -> AsyncIterator[aiosqlite.Connection]:
        async with aiosqlite.connect(self.database_path) as connection:
            connection.row_factory = aiosqlite.Row
            await connection.execute("PRAGMA foreign_keys = ON")
            yield connection


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _conversation_from_row(row: aiosqlite.Row) -> Conversation:
    return Conversation(
        id=row["id"],
        canvas_id=row["canvas_id"],
        title=row["title"],
        is_active=bool(row["is_active"]),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


def _run_from_row(row: aiosqlite.Row) -> RunRecord:
    return RunRecord(
        id=row["id"],
        conversation_id=row["conversation_id"],
        status=row["status"],
        error_code=row["error_code"],
        started_at=datetime.fromisoformat(row["started_at"]),
        finished_at=(
            datetime.fromisoformat(row["finished_at"]) if row["finished_at"] else None
        ),
    )
