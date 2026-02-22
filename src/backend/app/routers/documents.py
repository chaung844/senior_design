import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.document import (
    DocumentUploadRequest,
    DocumentUploadResponse,
    DocumentConfirmResponse,
)
from app.models.document import Document
from app.models.user import User
from app.services.aws_services import AWSService
from app.utils.auth import get_current_user


router = APIRouter(prefix="/documents", tags=["documents"])

aws_service = AWSService()


@router.post("/upload-url", response_model=DocumentUploadResponse)
async def get_upload_url(
    request: DocumentUploadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file_uuid = str(uuid.uuid4())
    s3_key = f"{file_uuid}_{request.file_name}"
    new_doc = Document(
        uploaded_by=current_user.user_id,
        file_name=request.file_name,
        s3_key=s3_key,
        document_type=request.document_type,
        status="pending_upload",
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)

    upload_url = aws_service.generate_presigned_url(
        s3_key=s3_key, file_type=request.file_type
    )

    if not upload_url:
        raise HTTPException(status_code=500, detail="Failed to generate upload URL")

    return {
        "upload_url": upload_url,
        "document_id": new_doc.document_id,
        "s3_key": s3_key,
    }


@router.post("/{document_id}/confirm-upload", response_model=DocumentConfirmResponse)
async def confirm_upload(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not aws_service.verify_s3_upload(doc.s3_key):
        raise HTTPException(
            status_code=400,
            detail="File not found in S3. The upload might still be in progress.",
        )

    msg_type = "parse_receipt" if doc.document_type == "receipt" else "parse_statement"

    payload = {
        "document_id": doc.document_id,
        "s3_key": doc.s3_key,
        "user_id": doc.uploaded_by,
    }

    sqs_res = aws_service.enqueue_parsing(message_type=msg_type, payload=payload)

    if not sqs_res:
        raise HTTPException(
            status_code=500, detail="Failed to enqueue document for processing"
        )

    doc.status = "pending_processing"
    await db.commit()

    return doc
