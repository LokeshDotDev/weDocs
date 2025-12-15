# Use ubuntu with pdf2htmlEX available
FROM ubuntu:22.04

# Install pdf2htmlEX and Python dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pdf2htmlex \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy FastAPI app
COPY main.py .
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 5002

# Run the service
CMD ["python3", "main.py"]
