import pytest

from agent_service.repository import ConversationRepository
from agent_service.persistence import open_checkpointer


@pytest.mark.asyncio
async def test_only_one_conversation_is_active_per_canvas(tmp_path):
    repo = ConversationRepository(tmp_path / "chat.sqlite")
    await repo.setup()

    first = await repo.create_conversation("canvas_001")
    second = await repo.create_conversation("canvas_001")
    rows = await repo.list_conversations("canvas_001")

    assert first.is_active is True
    assert second.is_active is True
    assert [row.id for row in rows if row.is_active] == [second.id]


@pytest.mark.asyncio
async def test_activating_an_older_conversation_is_transactional(tmp_path):
    repo = ConversationRepository(tmp_path / "chat.sqlite")
    await repo.setup()
    first = await repo.create_conversation("canvas_001")
    await repo.create_conversation("canvas_001")

    activated = await repo.activate_conversation(first.id)
    rows = await repo.list_conversations("canvas_001")

    assert activated.id == first.id
    assert [row.id for row in rows if row.is_active] == [first.id]


@pytest.mark.asyncio
async def test_run_transitions_are_persisted(tmp_path):
    repo = ConversationRepository(tmp_path / "chat.sqlite")
    await repo.setup()
    conversation = await repo.create_conversation("canvas_001")

    run = await repo.start_run(conversation.id)
    await repo.finish_run(run.id, "cancelled")

    stored = await repo.get_run(run.id)
    assert stored.status == "cancelled"
    assert stored.finished_at is not None


@pytest.mark.asyncio
async def test_first_message_sets_a_normalized_title_once(tmp_path):
    repo = ConversationRepository(tmp_path / "chat.sqlite")
    await repo.setup()
    conversation = await repo.create_conversation("canvas_001")

    await repo.update_title_from_first_message(conversation.id, "  Build\nlaunch board  ")
    await repo.update_title_from_first_message(conversation.id, "Do not replace")

    stored = await repo.get_conversation(conversation.id)
    assert stored is not None
    assert stored.title == "Build launch board"


@pytest.mark.asyncio
async def test_checkpointer_persists_thread_state_in_the_same_database(tmp_path):
    database_path = tmp_path / "chat.sqlite"

    async with open_checkpointer(database_path) as checkpointer:
        config = {"configurable": {"thread_id": "conversation:one"}}
        assert await checkpointer.aget_tuple(config) is None

    assert database_path.is_file()
