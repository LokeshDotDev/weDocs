import io
import os
from minio import Minio
from config import config
from logger import get_logger

logger = get_logger(__name__)

class MinIOHandler:
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
        self.bucket = config.MINIO_BUCKET
    
    def download_file(self, object_key: str) -> io.BytesIO:
        """Download file from MinIO and return BytesIO object."""
        try:
            logger.info(f"Downloading from MinIO: {object_key}")
            response = self.client.get_object(self.bucket, object_key)
            data = io.BytesIO(response.read())
            response.close()
            logger.info(f"✅ Downloaded {object_key}")
            return data
        except Exception as e:
            logger.error(f"❌ Download failed for {object_key}: {e}")
            raise
    
    def upload_file(
        self, 
        object_key: str, 
        file_data: io.BytesIO, 
        content_type: str = "application/octet-stream"
    ) -> None:
        """Upload file to MinIO from BytesIO object."""
        try:
            file_data.seek(0)
            file_size = len(file_data.getvalue())
            logger.info(f"Uploading to MinIO: {object_key} ({file_size} bytes)")
            
            self.client.put_object(
                self.bucket,
                object_key,
                file_data,
                file_size,
                content_type=content_type,
            )
            logger.info(f"✅ Uploaded {object_key}")
        except Exception as e:
            logger.error(f"❌ Upload failed for {object_key}: {e}")
            raise

minio_handler = MinIOHandler()
