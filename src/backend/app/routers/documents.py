import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import DocumentStatus, DocumentType, JobStatus, JobType
from app.models.document import Document
from app.models.job import Job
from app.models.user import User
from app.schemas.document import (
    DocumentConfirmResponse,
    DocumentListResponse,
    DocumentRead,
    DocumentUploadRequest,
    DocumentUploadResponse,
)
from app.services.aws_services import AWSService, get_aws_service
from app.utils.access import (
    _assert_can_write,
    apply_document_access_filter,
    get_owned_document,
)
from app.utils.auth import get_current_user, verify_csrf_token

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post(
    "/upload-url",
    response_model=DocumentUploadResponse,
    dependencies=[Depends(verify_csrf_token)],
)
async def get_upload_url(
    request: DocumentUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    aws_service: AWSService = Depends(get_aws_service),
):
    _assert_can_write(current_user)

    file_uuid = str(uuid.uuid4())
    s3_key = f"{file_uuid}_{request.file_name}"
    new_doc = Document(
        uploaded_by=current_user.user_id,
        file_name=request.file_name,
        s3_key=s3_key,
        document_type=request.document_type,
        account_id=request.account_id,
        status=DocumentStatus.pending_upload,
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    upload_url = await aws_service.async_generate_presigned_url(
        s3_key=s3_key, file_type=request.file_type
    )

    if not upload_url:
        raise HTTPException(status_code=500, detail="Failed to generate upload URL")

    return {
        "upload_url": upload_url,
        "document_id": new_doc.document_id,
        "s3_key": s3_key,
    }


@router.post(
    "/{document_id}/confirm-upload",
    response_model=DocumentConfirmResponse,
    dependencies=[Depends(verify_csrf_token)],
)
async def confirm_upload(
    document_id: int,
    statement_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    aws_service: AWSService = Depends(get_aws_service),
):
    _assert_can_write(current_user)

    doc = await get_owned_document(document_id, current_user, db, write=True)

    if not await aws_service.async_verify_s3_upload(doc.s3_key):
        raise HTTPException(
            status_code=400,
            detail="File not found in S3. The upload might still be in progress.",
        )

    # Create a parsing job for this document so the frontend can poll status.
    job = Job(
        name=f"Parse document {doc.document_id}",
        job_type=JobType.parsing,
        status=JobStatus.pending,
        created_by=current_user.user_id,
        document_id=doc.document_id,
    )
    db.add(job)
    await db.flush()

    msg_type = "parse_receipt" if doc.document_type == "receipt" else "parse_statement"

    payload = {
        "document_id": doc.document_id,
        "s3_key": doc.s3_key,
        "user_id": doc.uploaded_by,
        "account_id": doc.account_id,
        "job_id": job.job_id,
        "statement_id": statement_id
        if doc.document_type == DocumentType.receipt
        else doc.statement_id,
    }

    sqs_res = await aws_service.async_enqueue_parsing(
        message_type=msg_type, payload=payload
    )

    if not sqs_res:
        raise HTTPException(
            status_code=500, detail="Failed to enqueue document for processing"
        )

    doc.status = DocumentStatus.pending_processing
    await db.commit()

    return DocumentConfirmResponse(
        document_id=doc.document_id,
        status=doc.status,
        job_id=job.job_id,
    )


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    status: Optional[DocumentStatus] = Query(default=None),
    document_type: Optional[DocumentType] = Query(default=None),
    account_id: Optional[int] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_filter = [Document.deleted_at.is_(None)]
    apply_document_access_filter(base_filter, current_user)

    if status is not None:
        base_filter.append(Document.status == status)
    if document_type is not None:
        base_filter.append(Document.document_type == document_type)
    if account_id is not None:
        base_filter.append(Document.account_id == account_id)

    total_query = select(func.count()).select_from(Document).where(*base_filter)
    total = (await db.execute(total_query)).scalar_one()

    rows_query = (
        select(Document)
        .where(*base_filter)
        .order_by(Document.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(rows_query)
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=[DocumentRead.model_validate(doc) for doc in documents],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await get_owned_document(document_id, current_user, db)


@router.delete(
    "/{document_id}", status_code=204, dependencies=[Depends(verify_csrf_token)]
)
async def delete_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    aws_service: AWSService = Depends(get_aws_service),
):
    _assert_can_write(current_user)

    doc = await get_owned_document(document_id, current_user, db, write=True)
    doc.soft_delete()
    await db.commit()

    background_tasks.add_task(aws_service.async_delete_s3_object, doc.s3_key)

    return Response(status_code=204)
