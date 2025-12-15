FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

# Install pdf2htmlEX and Python
RUN apt-get update && apt-get install -y \
    pdf2htmlex \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy conversion script
COPY convert.py /app/

# Set entrypoint
ENTRYPOINT ["python3", "convert.py"]
