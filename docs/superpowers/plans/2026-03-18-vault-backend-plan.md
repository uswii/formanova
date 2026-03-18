# Vault Feature — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `user_assets` table, `POST /assets` + `GET /assets` FastAPI endpoints, and a one-time backfill script to power the My Products + My Models vault feature.

**Architecture:** New `user_assets` ownership table sits on top of the existing `artifacts` CAS table. `POST /assets` upserts into both tables (idempotent via SHA-256 uniqueness). `GET /assets` returns user-scoped assets with fresh SAS thumbnail URLs generated at query time. A one-time backfill script populates historical data from `workflow_executions.input_payload`. The frontend calls FastAPI directly — no proxy layer.

**Tech Stack:** Python, FastAPI, SQLAlchemy, PostgreSQL, pytest

**Spec:** Read the full spec before starting — it is the source of truth for API contracts and data model decisions. Path (in the frontend repo, share it with this session): `docs/superpowers/specs/2026-03-18-vault-feature-design.md`

---

## ⚠️ Task 0: Codebase Verification (MANDATORY — complete before any implementation)

**Purpose:** This plan was written from the frontend repo without direct access to this backend codebase. You have the ground truth. Verify the plan against reality before writing a single line of implementation.

**Files to read:**
- `src/database/models.py` — confirm exact class names, field names, SQLAlchemy Base class, imports, FK conventions, and whether `Artifact`, `WorkflowExecution`, `User` match what the spec describes
- `src/database/repository.py` — confirm function signature patterns, how DB sessions are passed, return types, whether `get_artifact_by_hash` exists
- `src/server.py` — confirm how endpoints are registered (routers? direct on `app`?), how auth is extracted from JWT (middleware? `Depends()`?), what the current user object looks like
- `src/artifact_store/azure_storage.py` — confirm whether a `get_sas_url()` or equivalent function exists that accepts an `azure://` URI and returns an HTTPS SAS URL
- Any existing migration files — confirm migration tool (Alembic? raw SQL? custom runner?) and file format
- Any existing test files — confirm pytest setup, how the test DB is created, what fixtures exist for auth/sessions

**Verify these specific claims from the spec:**
1. `artifacts` table has `sha256` (TEXT PK), `uri` (TEXT, azure:// format), `mime_type`, `size_bytes`, `created_at`
2. `workflow_executions` has `input_payload` JSONB, `user_id` FK → `users.id`
3. `users` table has UUID PK (this is the wallet table — NOT the auth table; auth table is separate and not in models.py)
4. `azure_store` can generate SAS URLs from azure:// URIs
5. The auth pattern: how does a protected endpoint get the current `user_id`?

**Write your findings to `docs/vault-plan-verification.md` in this repo:**

```markdown
# Backend Plan Verification Report
Date: [today]

## What matched the plan
- [list]

## Discrepancies found
- [each: what spec/plan says vs. what code actually does]

## Plan updates required before implementation
- [list]

## API contract changes (share with frontend session)
- [anything that changes endpoint shapes, auth headers, or response fields]
```

**Feedback mechanism:** If you found discrepancies that change the API contract between frontend and backend, tell the user:

> "I found discrepancies affecting the frontend plan. Please share `docs/vault-plan-verification.md` with the frontend Claude session so it updates its plan before implementing."

**Only proceed to Task 1 after the verification report is written.**

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `alembic/versions/XXXX_add_user_assets.py` | Create | DB migration — user_assets + FK columns |
| `src/database/models.py` | Modify | Add `UserAsset` model; add 2 FK columns to `WorkflowExecution` |
| `src/database/repository.py` | Modify | Add `register_asset()`, `get_user_assets()` |
| `src/api/assets.py` (or `src/server.py`) | Create/Modify | `POST /assets`, `GET /assets` endpoints |
| `tests/test_assets.py` | Create | 6 pytest tests |
| `scripts/backfill_user_assets.py` | Create | One-time backfill from workflow history |

---

### Task 1: DB Migration

**Files:**
- Create: migration file (format confirmed in Task 0)

- [ ] **Step 1: Write the migration**

Adapt format to whatever migration tool the codebase uses (confirmed in Task 0). The schema to create:

```sql
CREATE TABLE user_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    artifact_sha256 TEXT NOT NULL REFERENCES artifacts(sha256),
    asset_type TEXT NOT NULL,  -- 'jewelry_photo' | 'model_photo' | 'cad_model'
    name TEXT,
    source_workflow_id UUID REFERENCES workflow_executions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, artifact_sha256, asset_type)
);

ALTER TABLE workflow_executions
    ADD COLUMN input_jewelry_asset_id UUID REFERENCES user_assets(id),
    ADD COLUMN input_model_asset_id UUID REFERENCES user_assets(id);
```

If using Alembic:

```python
"""Add user_assets table and FK columns on workflow_executions

Revision ID: <generate with alembic revision>
Revises: <previous revision>
Create Date: 2026-03-18
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table(
        'user_assets',
        sa.Column('id', sa.UUID(), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('user_id', sa.UUID(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('tenant_id', sa.UUID(), sa.ForeignKey('tenants.id'), nullable=True),
        sa.Column('artifact_sha256', sa.Text(), sa.ForeignKey('artifacts.sha256'), nullable=False),
        sa.Column('asset_type', sa.Text(), nullable=False),
        sa.Column('name', sa.Text(), nullable=True),
        sa.Column('source_workflow_id', sa.UUID(), sa.ForeignKey('workflow_executions.id'), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('NOW()')),
        sa.UniqueConstraint('user_id', 'artifact_sha256', 'asset_type', name='uq_user_asset_per_user'),
    )
    op.add_column('workflow_executions',
        sa.Column('input_jewelry_asset_id', sa.UUID(), sa.ForeignKey('user_assets.id'), nullable=True))
    op.add_column('workflow_executions',
        sa.Column('input_model_asset_id', sa.UUID(), sa.ForeignKey('user_assets.id'), nullable=True))

def downgrade():
    op.drop_column('workflow_executions', 'input_model_asset_id')
    op.drop_column('workflow_executions', 'input_jewelry_asset_id')
    op.drop_table('user_assets')
```

- [ ] **Step 2: Preview migration without applying**

```bash
# Alembic:
alembic upgrade head --sql

# Or your tool's equivalent dry-run
```

Inspect the generated SQL — confirm FK targets and UNIQUE constraint look correct.

- [ ] **Step 3: Apply migration**

```bash
alembic upgrade head
```

- [ ] **Step 4: Verify in psql**

```sql
\d user_assets
-- Expect: id, user_id, tenant_id, artifact_sha256, asset_type, name, source_workflow_id, created_at, unique constraint

\d workflow_executions
-- Expect: input_jewelry_asset_id and input_model_asset_id columns present (nullable)
```

- [ ] **Step 5: Commit**

```bash
git add alembic/
git commit -m "feat: add user_assets migration and FK columns on workflow_executions"
```

---

### Task 2: UserAsset SQLAlchemy Model

**Files:**
- Modify: `src/database/models.py`

- [ ] **Step 1: Read the existing models file**

Note the exact Base class, import style, and how other models define UUID PKs and FKs (e.g., `Column(UUID(as_uuid=True), ...)`).

- [ ] **Step 2: Add UserAsset class (follow existing model conventions exactly)**

```python
class UserAsset(Base):
    __tablename__ = 'user_assets'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey('tenants.id'), nullable=True)
    artifact_sha256 = Column(Text, ForeignKey('artifacts.sha256'), nullable=False)
    asset_type = Column(Text, nullable=False)  # 'jewelry_photo' | 'model_photo' | 'cad_model'
    name = Column(Text, nullable=True)
    source_workflow_id = Column(UUID(as_uuid=True), ForeignKey('workflow_executions.id'), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

    # Relationship to artifact (for JOIN access to uri/thumbnail)
    artifact = relationship('Artifact', backref='user_assets')
```

- [ ] **Step 3: Add FK columns to WorkflowExecution class**

Inside the existing `WorkflowExecution` class, add:

```python
input_jewelry_asset_id = Column(UUID(as_uuid=True), ForeignKey('user_assets.id'), nullable=True)
input_model_asset_id = Column(UUID(as_uuid=True), ForeignKey('user_assets.id'), nullable=True)
```

- [ ] **Step 4: Verify imports compile cleanly**

```bash
python -c "from src.database.models import UserAsset, WorkflowExecution; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add src/database/models.py
git commit -m "feat: add UserAsset model and FK columns to WorkflowExecution"
```

---

### Task 3: Repository Functions

**Files:**
- Modify: `src/database/repository.py`

- [ ] **Step 1: Read repository.py first**

Note: how sessions are passed (parameter? context manager?), how existing upsert-like operations are done.

- [ ] **Step 2: Add `register_asset()`**

```python
def register_asset(
    db,
    user_id: str,
    tenant_id: str | None,
    sha256: str,
    uri: str,
    mime_type: str,
    size_bytes: int,
    asset_type: str,
) -> UserAsset:
    """
    Upserts artifact (CAS) then user_asset (ownership).
    Safe to call multiple times with the same sha256 + user_id + asset_type.
    Uses ON CONFLICT DO NOTHING for both tables — no TOCTOU race condition under concurrent requests.
    """
    from sqlalchemy.dialects.postgresql import insert as pg_insert

    # True UPSERT for artifact — concurrent requests with the same SHA-256 are safe
    stmt = pg_insert(Artifact).values(
        sha256=sha256, uri=uri, mime_type=mime_type, size_bytes=size_bytes
    ).on_conflict_do_nothing(index_elements=['sha256'])
    db.execute(stmt)

    # True UPSERT for user_asset — idempotent per (user_id, artifact_sha256, asset_type)
    stmt2 = pg_insert(UserAsset).values(
        user_id=user_id,
        tenant_id=tenant_id,
        artifact_sha256=sha256,
        asset_type=asset_type,
    ).on_conflict_do_nothing(
        index_elements=['user_id', 'artifact_sha256', 'asset_type']
    )
    db.execute(stmt2)
    db.commit()

    # Fetch the row (may have existed before, or was just inserted)
    asset = db.query(UserAsset).filter(
        UserAsset.user_id == user_id,
        UserAsset.artifact_sha256 == sha256,
        UserAsset.asset_type == asset_type,
    ).one()
    return asset
```

- [ ] **Step 3: Add `get_user_assets()`**

```python
def get_user_assets(
    db,
    user_id: str,
    asset_type: str,
    page: int = 0,
    page_size: int = 20,
) -> tuple[list[UserAsset], int]:
    """Returns (items, total) for the calling user, scoped strictly by user_id from JWT.
    Uses joinedload to avoid N+1 queries when GET /assets accesses asset.artifact.uri."""
    from sqlalchemy.orm import joinedload
    query = (
        db.query(UserAsset)
        .options(joinedload(UserAsset.artifact))
        .filter(UserAsset.user_id == user_id, UserAsset.asset_type == asset_type)
        .order_by(UserAsset.created_at.desc())
    )
    total = query.count()
    items = query.offset(page * page_size).limit(page_size).all()
    return items, total
```

- [ ] **Step 4: Verify imports**

```bash
python -c "from src.database.repository import register_asset, get_user_assets; print('OK')"
```

- [ ] **Step 5: Commit**

```bash
git add src/database/repository.py
git commit -m "feat: add register_asset and get_user_assets repository functions"
```

---

### Task 4: POST /assets Endpoint (TDD)

**Files:**
- Create: `tests/test_assets.py`
- Create/Modify: `src/api/assets.py` (or add to `src/server.py` — follow existing pattern)

- [ ] **Step 1: Write the 3 failing POST tests**

*Adapt auth fixtures and test client setup to match existing test patterns (confirmed in Task 0).*

```python
# tests/test_assets.py

def test_post_assets_happy_path(client, auth_headers_user_a):
    payload = {
        "sha256": "a" * 64,
        "uri": "azure://container/path/ring.jpg",
        "mime_type": "image/jpeg",
        "size_bytes": 102400,
        "asset_type": "jewelry_photo",
    }
    response = client.post("/assets", json=payload, headers=auth_headers_user_a)
    assert response.status_code == 200
    data = response.json()
    assert "asset_id" in data
    assert "https_url" in data


def test_post_assets_dedup(client, auth_headers_user_a, db):
    """Same SHA-256 sent twice by the same user → exactly one artifact row and one user_asset row."""
    payload = {
        "sha256": "b" * 64,
        "uri": "azure://container/dedup.jpg",
        "mime_type": "image/jpeg",
        "size_bytes": 1024,
        "asset_type": "jewelry_photo",
    }
    client.post("/assets", json=payload, headers=auth_headers_user_a)
    client.post("/assets", json=payload, headers=auth_headers_user_a)  # duplicate

    from src.database.models import Artifact, UserAsset
    assert db.query(Artifact).filter(Artifact.sha256 == payload["sha256"]).count() == 1
    # Filter by user_id to test per-user dedup semantics (the UNIQUE constraint is per-user, not global).
    # Adapt the user_id extraction to your fixture pattern (confirmed in Task 0).
    # Option A — if fixture exposes user_id directly: user_a_id = auth_headers_user_a.user_id
    # Option B — query from DB: user_a = db.query(User).filter(User.email == "user_a@test.com").first(); user_a_id = str(user_a.id)
    user_a_id = auth_headers_user_a.user_id  # <-- adapt to your fixture
    assert db.query(UserAsset).filter(
        UserAsset.artifact_sha256 == payload["sha256"],
        UserAsset.user_id == user_a_id,
    ).count() == 1


def test_post_assets_requires_token(client):
    """Request with no auth token is rejected with 401."""
    response = client.post("/assets", json={
        "sha256": "c" * 64,
        "uri": "azure://container/test.jpg",
        "mime_type": "image/jpeg",
        "size_bytes": 1024,
        "asset_type": "jewelry_photo",
    })
    assert response.status_code == 401


def test_post_assets_auth_isolation(client, auth_headers_user_a, auth_headers_user_b, db):
    """User B uploading the same SHA-256 as user A creates a separate user_asset row scoped to user B."""
    sha256 = "d" * 64
    payload = {
        "sha256": sha256,
        "uri": "azure://container/shared.jpg",
        "mime_type": "image/jpeg",
        "size_bytes": 1024,
        "asset_type": "jewelry_photo",
    }
    # User A registers the asset
    resp_a = client.post("/assets", json=payload, headers=auth_headers_user_a)
    assert resp_a.status_code == 200
    asset_id_a = resp_a.json()["asset_id"]

    # User B registers the same SHA-256 — must create a separate user_asset scoped to user B
    resp_b = client.post("/assets", json=payload, headers=auth_headers_user_b)
    assert resp_b.status_code == 200
    asset_id_b = resp_b.json()["asset_id"]

    # Different ownership rows for the same underlying artifact
    assert asset_id_a != asset_id_b

    from src.database.models import Artifact, UserAsset
    # Only one artifact row for this SHA-256 (CAS dedup)
    assert db.query(Artifact).filter(Artifact.sha256 == sha256).count() == 1
    # Two user_asset rows — one per user
    assert db.query(UserAsset).filter(UserAsset.artifact_sha256 == sha256).count() == 2
```

- [ ] **Step 2: Run — confirm all 3 FAIL**

```bash
pytest tests/test_assets.py -k "post" -v
```

Expected: FAIL (endpoint not defined)

- [ ] **Step 3: Implement POST /assets**

Follow existing endpoint registration pattern (found in Task 0):

```python
from pydantic import BaseModel
from uuid import UUID

class RegisterAssetRequest(BaseModel):
    sha256: str
    uri: str
    mime_type: str
    size_bytes: int
    asset_type: str  # 'jewelry_photo' | 'model_photo' | 'cad_model'

class RegisterAssetResponse(BaseModel):
    asset_id: str  # UUID serialized as string (e.g., "550e8400-e29b-41d4-a716-446655440000")
    https_url: str

@router.post("/assets", response_model=RegisterAssetResponse)
async def post_assets(
    body: RegisterAssetRequest,
    current_user=Depends(get_current_user),  # replace with actual auth dependency
    db=Depends(get_db),
):
    # Derive https_url from azure:// URI
    # azure://container/path/blob.jpg → https://<account>.blob.core.windows.net/container/path/blob.jpg
    # Use existing azure_store utility if one exists; otherwise string manipulation
    https_url = azure_uri_to_https(body.uri)  # adapt to existing helper or write inline

    asset = register_asset(
        db=db,
        user_id=str(current_user.id),
        tenant_id=str(current_user.tenant_id) if getattr(current_user, 'tenant_id', None) else None,
        sha256=body.sha256,
        uri=body.uri,
        mime_type=body.mime_type,
        size_bytes=body.size_bytes,
        asset_type=body.asset_type,
    )

    return RegisterAssetResponse(asset_id=str(asset.id), https_url=https_url)
```

- [ ] **Step 4: Run — confirm all 3 PASS**

```bash
pytest tests/test_assets.py -k "post" -v
```

Expected: 3/3 PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/assets.py tests/test_assets.py
git commit -m "feat: add POST /assets endpoint with auth guard and dedup"
```

---

### Task 5: GET /assets Endpoint (TDD)

**Files:**
- Modify: `tests/test_assets.py`
- Modify: `src/api/assets.py`

- [ ] **Step 1: Write the 3 failing GET tests**

```python
def test_get_assets_scoped_to_user(client, auth_headers_user_a, auth_headers_user_b):
    # User A uploads
    client.post("/assets", json={
        "sha256": "d" * 64, "uri": "azure://c/user-a.jpg",
        "mime_type": "image/jpeg", "size_bytes": 1024, "asset_type": "jewelry_photo",
    }, headers=auth_headers_user_a)

    # User B's list should not include user A's asset
    response = client.get("/assets?asset_type=jewelry_photo", headers=auth_headers_user_b)
    assert response.status_code == 200
    items = response.json()["items"]
    # Verify none of user B's items have the sha256 that user A uploaded
    assert not any(i.get("id") for i in items if i.get("artifact_sha256") == "d" * 64)


def test_get_assets_pagination(client, auth_headers_user_a):
    for i in range(3):
        client.post("/assets", json={
            "sha256": f"e{i:063d}", "uri": f"azure://c/ring-{i}.jpg",
            "mime_type": "image/jpeg", "size_bytes": 1024, "asset_type": "jewelry_photo",
        }, headers=auth_headers_user_a)

    response = client.get("/assets?asset_type=jewelry_photo&page=0&page_size=2", headers=auth_headers_user_a)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] >= 3
    assert data["page"] == 0
    assert data["page_size"] == 2


def test_get_assets_type_filter(client, auth_headers_user_a):
    client.post("/assets", json={
        "sha256": "f" * 64, "uri": "azure://c/j.jpg",
        "mime_type": "image/jpeg", "size_bytes": 1, "asset_type": "jewelry_photo",
    }, headers=auth_headers_user_a)
    client.post("/assets", json={
        "sha256": "g" * 64, "uri": "azure://c/m.jpg",
        "mime_type": "image/jpeg", "size_bytes": 1, "asset_type": "model_photo",
    }, headers=auth_headers_user_a)

    response = client.get("/assets?asset_type=jewelry_photo", headers=auth_headers_user_a)
    items = response.json()["items"]
    assert all(item["asset_type"] == "jewelry_photo" for item in items)
```

- [ ] **Step 2: Run — confirm all 3 FAIL**

```bash
pytest tests/test_assets.py -k "get" -v
```

- [ ] **Step 3: Implement GET /assets**

`thumbnail_url` must be a fresh SAS URL generated from the stored `azure://` URI. Use the existing `azure_store.get_sas_url()` function (or equivalent found in Task 0):

```python
from pydantic import BaseModel
from typing import Optional
from src.artifact_store.azure_storage import get_sas_url  # confirm exact import

class AssetItem(BaseModel):
    id: str
    asset_type: str
    created_at: str
    thumbnail_url: str   # fresh SAS URL, 1-hour expiry
    name: Optional[str] = None

class GetAssetsResponse(BaseModel):
    items: list[AssetItem]
    total: int
    page: int
    page_size: int

@router.get("/assets", response_model=GetAssetsResponse)
async def get_assets(
    asset_type: str,
    page: int = 0,
    page_size: int = 20,
    current_user=Depends(get_current_user),
    db=Depends(get_db),
):
    items, total = get_user_assets(db, str(current_user.id), asset_type, page, page_size)
    result = []
    for asset in items:
        # Generate fresh SAS URL from stored azure:// URI
        sas_url = get_sas_url(asset.artifact.uri, expiry_minutes=60)
        result.append(AssetItem(
            id=str(asset.id),
            asset_type=asset.asset_type,
            created_at=asset.created_at.isoformat(),
            thumbnail_url=sas_url,
            name=asset.name,
        ))
    return GetAssetsResponse(items=result, total=total, page=page, page_size=page_size)
```

*If `get_sas_url` has a different signature (confirmed in Task 0), adapt accordingly.*

- [ ] **Step 4: Run all 6 tests**

```bash
pytest tests/test_assets.py -v
```

Expected: 6/6 PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/assets.py tests/test_assets.py
git commit -m "feat: add GET /assets endpoint with SAS thumbnails, pagination, user scoping"
```

---

### Task 6: Backfill Script

**Files:**
- Create: `scripts/backfill_user_assets.py`

**IMPORTANT:** Always run with `--dry-run` first. Inspect the output. Only run live after confirming counts and URLs look correct.

- [ ] **Step 1: Write the script**

```python
#!/usr/bin/env python3
"""
Backfill user_assets from workflow_executions.input_payload.

Scope: single-photo workflows only (fields: jewelry_image_url, model_image_url).
Bulk workflows are excluded (different payload schema).

Usage:
    python scripts/backfill_user_assets.py --dry-run   # inspect only, no DB writes
    python scripts/backfill_user_assets.py              # live run
"""
import argparse
import hashlib
import re
from urllib.parse import urlparse

# Adapt these imports to the actual module paths in this codebase
from src.database.session import get_session        # confirm import path
from src.database.models import WorkflowExecution, UserAsset, Artifact, User
from src.artifact_store.azure_storage import download_blob  # confirm — must accept blob path, use service creds

AZURE_URL_PATTERN = re.compile(r'https://[^/]+\.blob\.core\.windows\.net/')


def is_azure_url(url: str) -> bool:
    return bool(AZURE_URL_PATTERN.match(url))


def blob_path_from_url(url: str) -> str:
    """
    Extract container/blobname from an Azure HTTPS or SAS URL.
    Strips SAS query string first.
    e.g. https://account.blob.core.windows.net/container/path/blob.jpg?sv=...
    → container/path/blob.jpg
    """
    parsed = urlparse(url)
    # path = /container/path/blob.jpg — strip leading slash
    return parsed.path.lstrip('/')


def compute_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def backfill(dry_run: bool):
    db = next(get_session())  # adapt to actual session pattern

    # NOTE: loads all matching rows into memory. Acceptable at current scale (19 users, ~hundreds of rows).
    # If execution count grows beyond ~10k rows, add .yield_per(100) or paginate.
    executions = db.query(WorkflowExecution).filter(
        WorkflowExecution.input_payload.isnot(None)
    ).all()

    jewelry_count = model_count = skip_count = error_count = 0

    for ex in executions:
        payload = ex.input_payload or {}
        user_id = str(ex.user_id)

        user = db.query(User).filter(User.id == ex.user_id).first()
        tenant_id = str(user.tenant_id) if user and getattr(user, 'tenant_id', None) else None

        for field, asset_type in [
            ('jewelry_image_url', 'jewelry_photo'),
            ('model_image_url', 'model_photo'),
        ]:
            url = payload.get(field)
            if not url or not is_azure_url(url):
                skip_count += 1
                continue

            blob_path = blob_path_from_url(url)

            try:
                # Download using backend's Azure service credentials
                # SAS tokens in stored URLs may be expired — service creds bypass this
                blob_bytes = download_blob(blob_path)  # adapt to actual function signature
                sha256 = compute_sha256(blob_bytes)
                azure_uri = f"azure://{blob_path}"

                if dry_run:
                    print(f"[DRY-RUN] user={user_id} type={asset_type} sha256={sha256[:12]}... blob={blob_path}")
                    if asset_type == 'jewelry_photo':
                        jewelry_count += 1
                    else:
                        model_count += 1
                    continue

                # Upsert artifact
                if not db.query(Artifact).filter(Artifact.sha256 == sha256).first():
                    db.add(Artifact(
                        sha256=sha256, uri=azure_uri,
                        mime_type='image/jpeg', size_bytes=len(blob_bytes)
                    ))

                # Upsert user_asset
                existing = db.query(UserAsset).filter(
                    UserAsset.user_id == user_id,
                    UserAsset.artifact_sha256 == sha256,
                    UserAsset.asset_type == asset_type,
                ).first()
                if not existing:
                    db.add(UserAsset(
                        user_id=user_id, tenant_id=tenant_id,
                        artifact_sha256=sha256, asset_type=asset_type,
                    ))
                    if asset_type == 'jewelry_photo':
                        jewelry_count += 1
                    else:
                        model_count += 1

                db.commit()

            except Exception as e:
                print(f"[ERROR] user={user_id} url={url}: {e}")
                error_count += 1
                db.rollback()

    prefix = '[DRY-RUN] ' if dry_run else ''
    print(f"\n{prefix}Results:")
    print(f"  Jewelry assets: {jewelry_count}")
    print(f"  Model assets:   {model_count}")
    print(f"  Skipped:        {skip_count}")
    print(f"  Errors:         {error_count}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    backfill(dry_run=args.dry_run)
```

- [ ] **Step 2: Run dry-run — inspect output carefully**

```bash
python scripts/backfill_user_assets.py --dry-run
```

Check: URLs look like Azure blob URLs, counts are plausible, no errors.

- [ ] **Step 3: Run live (only after dry-run looks correct)**

```bash
python scripts/backfill_user_assets.py
```

- [ ] **Step 4: Verify in database**

```sql
SELECT asset_type, COUNT(*) FROM user_assets GROUP BY asset_type;
SELECT COUNT(DISTINCT user_id) FROM user_assets;
```

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill_user_assets.py
git commit -m "feat: add backfill script for user_assets from workflow history"
```

---

### Task 7: Link Workflow Executions to Assets

**Files:**
- Modify: wherever `WorkflowExecution` rows are created (confirmed in Task 0 — likely in the Temporal workflow handler or the `/run/...` endpoint)

The frontend passes `input_jewelry_asset_id` and `input_model_asset_id` in the workflow payload. This task ensures those values get written to the `WorkflowExecution` FK columns when an execution is created.

- [ ] **Step 1: Find where WorkflowExecution rows are created**

In Task 0 you identified the server file and endpoint that creates `WorkflowExecution` rows. Read that code now.

Look for where the payload is parsed and the `WorkflowExecution` object is constructed / inserted.

- [ ] **Step 2: Read `input_jewelry_asset_id` and `input_model_asset_id` from the payload**

In the payload parsing section, extract the two optional fields:

```python
input_jewelry_asset_id = payload.get('input_jewelry_asset_id')
input_model_asset_id = payload.get('input_model_asset_id')
```

- [ ] **Step 3: Set the FK columns on the WorkflowExecution row**

When constructing the `WorkflowExecution` object (or when updating it after creation), set:

```python
if input_jewelry_asset_id:
    workflow_execution.input_jewelry_asset_id = uuid.UUID(input_jewelry_asset_id)
if input_model_asset_id:
    workflow_execution.input_model_asset_id = uuid.UUID(input_model_asset_id)
```

Both columns are nullable — skip assignment if the value is absent or falsy.

- [ ] **Step 4: Verify in database after a test generation**

Run a generation from the frontend with a vault asset pre-loaded. Then:

```sql
SELECT id, input_jewelry_asset_id, input_model_asset_id
FROM workflow_executions
ORDER BY created_at DESC
LIMIT 5;
```

Expect: the most recent row has non-null `input_jewelry_asset_id` or `input_model_asset_id`.

- [ ] **Step 5: Commit**

```bash
# Replace with the actual file path you modified in Steps 2–3 (identified in Task 0), e.g.:
# git add src/temporal/workflow_handler.py
git commit -m "feat: set input_jewelry_asset_id / input_model_asset_id FK on WorkflowExecution from payload"
```

---

## Phase 0 Complete Checklist

- [ ] Verification report written (`docs/vault-plan-verification.md`)
- [ ] Migration applied and confirmed in psql
- [ ] All 6 pytest tests pass
- [ ] Backfill dry-run reviewed and confirmed
- [ ] Backfill live run complete
- [ ] Workflow execution FK columns populated from payload (Task 7 verified)
- [ ] **Tell the user:** "Backend Phase 0 complete. `POST /assets` and `GET /assets` are live. Frontend can now implement Phase 1."
- [ ] **If verification report contained API contract changes:** share with frontend session before frontend begins implementation.
