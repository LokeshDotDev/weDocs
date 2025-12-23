"""
minio_utils.py

MinIO utilities: download/upload files
"""

import io
from minio import Minio
from config import config
from logger import get_logger

logger = get_logger(__name__)


class MinIOClient:
    def __init__(self):
        endpoint_parts = config.MINIO_ENDPOINT.split(":")
        host = endpoint_parts[0]
        port = int(endpoint_parts[1]) if len(endpoint_parts) > 1 else 9000
        
        self.client = Minio(
            endpoint=f"{host}:{port}",
            access_key=config.MINIO_ACCESS_KEY,
            secret_key=config.MINIO_SECRET_KEY,
            secure=config.MINIO_USE_SSL,
        )

    def download(self, bucket: str, object_key: str) -> io.BytesIO:
        """Download file from MinIO."""
        logger.info(f"⬇️  Downloading from MinIO: {bucket}/{object_key}")
        try:
            response = self.client.get_object(bucket, object_key)
            data = io.BytesIO(response.read())
            response.close()
            logger.info(f"✅ Downloaded {object_key} ({len(data.getvalue())} bytes)")
            return data
        except Exception as e:
            logger.error(f"❌ Download failed: {e}")
            raise

    def upload(self, bucket: str, object_key: str, file_data: io.BytesIO, content_type: str = "application/octet-stream"):
        """Upload file to MinIO."""
        logger.info(f"⬆️  Uploading to MinIO: {bucket}/{object_key}")
        try:
            file_data.seek(0)
            file_size = len(file_data.getvalue())
            self.client.put_object(
                bucket,
                object_key,
                file_data,
                file_size,
                content_type=content_type,
            )
            logger.info(f"✅ Uploaded {object_key} ({file_size} bytes)")
        except Exception as e:
            logger.error(f"❌ Upload failed: {e}")
            raise


minio_client = MinIOClient()
