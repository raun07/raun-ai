import sys
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent

for candidate in (str(REPO_ROOT), str(BACKEND_DIR)):
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

try:
    from backend.main import app
    from backend.main import get_current_user
    import backend.main as main_module
except ModuleNotFoundError:
    from main import app
    from main import get_current_user
    import main as main_module


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://testserver"
    ) as async_client:
        yield async_client


@pytest.mark.asyncio
async def test_pipeline_completes_with_mocked_services(client, monkeypatch):
    async def fake_get_or_create_user(user_id, email=None):
        return {"id": user_id, "tier": "pro", "credits": 999}

    async def fake_create_generation(user_id, job_id, prompt):
        return {"user_id": user_id, "job_id": job_id, "prompt": prompt}

    async def fake_update_generation(*args, **kwargs):
        return {"ok": True}

    async def fake_download_all_scenes(
        scenes, timeout_seconds=20, orientation="portrait"
    ):
        return [
            f"https://example.com/scene_{index}.mp4" for index, _ in enumerate(scenes)
        ]

    async def fake_generate_scene_voices(scenes, progress_callback=None):
        if progress_callback:
            progress_callback(100, "done")
        return ["voice_0.mp3", "voice_1.mp3"]

    def fake_generate_script(prompt, scene_count=4, **kwargs):
        return {
            "mood": "cinematic",
            "scenes": [
                {
                    "id": i + 1,
                    "description": f"test scene {i + 1}",
                    "narration": "test narration",
                    "duration": 3,
                    "visual_keywords": ["test"],
                }
                for i in range(scene_count)
            ],
        }

    def fake_merge_voices(voice_files, progress_callback=None):
        if progress_callback:
            progress_callback(100, "merged")
        return "voice_full.mp3"

    def fake_download_file(url, filename):
        return filename

    # FIX: added **kwargs so logo_path, outro_path, and any future
    # brand-kit params added in Task 4 don't cause unexpected-keyword errors
    def fake_create_video(
        scenes,
        voice,
        music,
        sfx,
        mood=None,
        orientation="portrait",
        progress_callback=None,
        **kwargs,
    ):
        if progress_callback:
            progress_callback(100, "rendered")
        return str(BACKEND_DIR / "files" / "final_mock.mp4")

    def fake_upload_video_in_background(job_id, final_path, script):
        main_module.persist_job_updates(
            job_id,
            {
                "status": "completed",
                "result": {
                    "video_url": "https://cloudinary.example/final.mp4",
                    "local_video_url": f"/api/film/files/{job_id}/final_reel.mp4",
                    "local_file_path": final_path,
                },
                "progress": 100,
                "message": "Upload complete",
            },
        )

    class ImmediateThread:
        def __init__(self, target=None, args=None, daemon=None):
            self.target = target
            self.args = args or ()

        def start(self):
            if self.target:
                self.target(*self.args)

    app.dependency_overrides[get_current_user] = lambda: "user_pipeline"
    monkeypatch.setattr(main_module, "get_or_create_user", fake_get_or_create_user)
    monkeypatch.setattr(main_module, "create_generation", fake_create_generation)
    monkeypatch.setattr(main_module, "update_generation", fake_update_generation)
    monkeypatch.setattr(main_module, "generate_script", fake_generate_script)
    monkeypatch.setattr(main_module, "download_all_scenes", fake_download_all_scenes)
    monkeypatch.setattr(
        main_module, "generate_scene_voices", fake_generate_scene_voices
    )
    monkeypatch.setattr(main_module, "merge_voices", fake_merge_voices)
    monkeypatch.setattr(
        main_module, "get_music", lambda mood, job_id=None: "https://example.com/music.mp3"
    )
    monkeypatch.setattr(main_module, "get_sfx", lambda: "https://example.com/sfx.mp3")
    monkeypatch.setattr(main_module, "download_file", fake_download_file)
    monkeypatch.setattr(main_module, "create_video", fake_create_video)
    monkeypatch.setattr(
        main_module, "upload_video_in_background", fake_upload_video_in_background
    )
    monkeypatch.setattr(main_module.threading, "Thread", ImmediateThread)

    try:
        generate_response = await client.post(
            "/generate", json={"prompt": "A cinematic product launch at dawn"}
        )
        assert generate_response.status_code == 200
        job_id = generate_response.json()["job_id"]

        status_response = await client.get(f"/status/{job_id}")
        result_response = await client.get(f"/result/{job_id}")
    finally:
        app.dependency_overrides.clear()

    assert status_response.status_code == 200
    assert status_response.json()["status"] == "completed"
    assert status_response.json()["video_url"] == "https://cloudinary.example/final.mp4"

    assert result_response.status_code == 200
    assert result_response.json()["status"] == "completed"
    assert result_response.json()["video_url"] == "https://cloudinary.example/final.mp4"
