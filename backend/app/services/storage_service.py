import os
import uuid
import shutil
from pathlib import Path
from typing import Optional

STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "local")
S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "event-posters")
LOCAL_UPLOAD_DIR = Path("static/posters")

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _get_s3_client():
    import boto3
    from botocore.client import Config

    client = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
    )
    try:
        client.head_bucket(Bucket=S3_BUCKET)
    except Exception:
        client.create_bucket(Bucket=S3_BUCKET)
    return client


def upload_file(file_bytes: bytes, content_type: str, original_name: str) -> str:
    ext = Path(original_name).suffix or ".jpg"
    key = f"{uuid.uuid4().hex}{ext}"

    if STORAGE_BACKEND == "s3":
        client = _get_s3_client()
        client.put_object(
            Bucket=S3_BUCKET,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        return key

    LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest = LOCAL_UPLOAD_DIR / key
    dest.write_bytes(file_bytes)
    return f"/static/posters/{key}"


def get_file_url(key: str, expires: int = 3600) -> str:
    if not key:
        return ""
    if not key.startswith("/") and STORAGE_BACKEND == "s3":
        try:
            client = _get_s3_client()
            return client.generate_presigned_url(
                "get_object",
                Params={"Bucket": S3_BUCKET, "Key": key},
                ExpiresIn=expires,
            )
        except Exception:
            return ""
    return key


def delete_file(key: str) -> bool:
    if not key:
        return False
    if not key.startswith("/") and STORAGE_BACKEND == "s3":
        try:
            client = _get_s3_client()
            client.delete_object(Bucket=S3_BUCKET, Key=key)
            return True
        except Exception:
            return False
    local_path = Path(key.lstrip("/"))
    if local_path.exists():
        local_path.unlink()
    return True
