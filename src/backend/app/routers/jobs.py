from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import JobType
from app.models.document import Document
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobStatusDocument, JobStatusResponse
from app.utils.access import can_view_job
from app.utils.auth import get_current_user

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}/status", response_model=JobStatusResponse)
async def get_job_status(
    job_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job: Optional[Job] = await db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    if not can_view_job(job, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to view this job")

    documents: list[JobStatusDocument] = []

    if job.job_type == JobType.parsing and job.document_id is not None:
        document: Optional[Document] = await db.get(Document, job.document_id)
        if document is not None:
            documents.append(
                JobStatusDocument(
                    document_id=document.document_id,
                    file_name=document.file_name,
                    document_type=document.document_type,
                    status=document.status,
                )
            )

    # Reconciliation jobs: no job-documents link yet; documents array is empty.
    # When POST /jobs and job_documents are implemented, populate from that table.

    return JobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        job_type=job.job_type,
        documents=documents,
    )
