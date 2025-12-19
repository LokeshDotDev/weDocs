# <img src="./assets/bino-logo.svg" width=40 style="padding-top: 0px"/> Binoculars: Zero-Shot Detection of LLM-Generated Text [[paper]](https://arxiv.org/abs/2401.12070)[[demo]](https://huggingface.co/spaces/tomg-group-umd/Binoculars)

<p align="center">
  <img src="assets/binoculars.jpg" width="300" height="300" alt="ool Binoculars with Falcon on Top">
</p>

We introduce Binoculars, a state-of-the-art method for detecting AI-generated text. Binoculars is a
zero-shot and domain-agnostic (requires no training data) method. It is based on a simple idea: most
decoder-only, causal language models have a huge overlap in pretraining datasets, for e.g. Common Crawl, Pile, etc.
More details about the method and results can be found in our paper **Spotting LLMs with Binoculars: Zero-Shot
Detection of Machine-Generated Text**.

## Getting Started

### Environment Recommendation

**For this project, local development is strongly recommended over cloud environments like Google Colab.**

**Why?**

- ✅ Persistent model caching (download once, cache forever)
- ✅ Fast startup (10-25s first run, <1s subsequent requests)
- ✅ No session expiration or timeouts
- ✅ CPU-only inference (no GPU required)
- ✅ Production-aligned environment (VPS deployment target)
- ❌ Avoids Colab session resets and repeated downloads

### Local Development Setup

#### Prerequisites

- Python 3.9+
- pip or conda
- 8GB+ RAM
- SSD recommended (for faster model caching)

#### Installation

```bash
# Clone and navigate to the ai-detector directory
$ cd ai-detector-and-humanizer/ai-detector

# Create a virtual environment (optional but recommended)
$ python -m venv venv

# Activate virtual environment
# On Windows:
$ venv\Scripts\activate
# On macOS/Linux:
$ source venv/bin/activate

# Install dependencies
$ pip install -r requirements.txt

# Install Binoculars package
$ git clone https://github.com/ahans30/Binoculars.git
$ cd Binoculars
$ pip install -e .
$ cd ..
```

#### Running the API Server

```bash
# From ai-detector directory
$ python api.py

# Expected output:
# ============================================================
# 🚀 Starting Binoculars AI Detection API
# ============================================================
#
# 📍 API will be available at: http://localhost:5000
# Available endpoints:
#   GET  /health        - Health check
#   POST /detect        - Detect AI in single text
#   POST /batch-detect  - Detect AI in multiple texts
#
# ⏳ Starting server...
#    (Models will load on first request - ~10-25 seconds)
```

The API will be available at `http://localhost:5000` and accessible from `http://192.168.x.x:5000` on your local network.

### API Endpoints & Testing

#### 1. Health Check

```bash
GET http://localhost:5000/health

# Response:
{
  "service": "binoculars-detector",
  "status": "healthy",
  "initialized": false  # true after first request loads models
}
```

#### 2. Single Text Detection

```bash
POST http://localhost:5000/detect
Content-Type: application/json

{
  "text": "Your text to analyze here..."
}

# Response:
{
  "text": "Your text to analyze here...",
  "score": 0.75661373,
  "prediction": "Most likely AI-Generated",
  "confidence": 0.9766,
  "processing_time_ms": 125
}
```

#### 3. Batch Detection

```bash
POST http://localhost:5000/batch-detect
Content-Type: application/json

{
  "texts": [
    "First text to analyze...",
    "Second text to analyze..."
  ]
}

# Response:
{
  "results": [
    {
      "text": "First text to analyze...",
      "score": 0.7566,
      "prediction": "Most likely AI-Generated"
    },
    {
      "text": "Second text to analyze...",
      "score": 0.2134,
      "prediction": "Most likely Human-Written"
    }
  ],
  "batch_processing_time_ms": 250
}
```

#### Testing with curl

```bash
# Test 1: AI-generated text (ChatGPT) - expect score ~0.75+
curl -X POST http://localhost:5000/detect \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Dr. Capy Cosmos, a capybara unlike any other, astounded the scientific community with his groundbreaking research in astrophysics. With his keen sense of observation and unparalleled ability to interpret cosmic data, he uncovered new insights into the mysteries of black holes and the origins of the universe."
  }'

# Test 2: Human-written text - expect score ~0.1-0.3
curl -X POST http://localhost:5000/detect \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The capybara is the world'\''s largest living rodent. It'\''s native to South America and loves water."
  }'
```

### Usage

This implementation uses _Falcon-7B_ and _Falcon-7B-Instruct_ models for scoring with a fixed threshold optimized for F1 score across diverse domains.

To detect AI-generated text, please use the following code snippet:

```python
from binoculars import Binoculars

bino = Binoculars()

# ChatGPT (GPT-4) output when prompted with “Can you write a few sentences about a capybara that is an astrophysicist?"
sample_string = '''Dr. Capy Cosmos, a capybara unlike any other, astounded the scientific community with his
groundbreaking research in astrophysics. With his keen sense of observation and unparalleled ability to interpret
cosmic data, he uncovered new insights into the mysteries of black holes and the origins of the universe. As he
peered through telescopes with his large, round eyes, fellow researchers often remarked that it seemed as if the
stars themselves whispered their secrets directly to him. Dr. Cosmos not only became a beacon of inspiration to
aspiring scientists but also proved that intellect and innovation can be found in the most unexpected of creatures.'''

print(bino.compute_score(sample_string))  # 0.75661373
print(bino.predict(sample_string))  # 'Most likely AI-Generated'
```

In the above code, user can also pass a `list` of `str` to `compute_score` and `predict` methods to get results for
the entire batch of samples.

### Demo

We have also made a demo available to predict AI-generated text interactively with a simple UI
using [gradio](https://github.com/gradio-app/gradio). You can run the demo using the following command:

```bash
$ python app.py
```

## Limitations

All AI-generated text detectors aim for accuracy, but none are perfect and can have multiple failure modes (e.g.,
Binoculars is more proficient in detecting English language text compared to other languages). This implementation is
for academic purposes only and should not be considered as a consumer product. We also strongly caution against using
Binoculars (or any detector) without human supervision.

## Cite our work

If you find this work useful, please cite our paper:

```bibtex
@misc{hans2024spotting,
      title={Spotting LLMs With Binoculars: Zero-Shot Detection of Machine-Generated Text},
      author={Abhimanyu Hans and Avi Schwarzschild and Valeriia Cherepanova and Hamid Kazemi and Aniruddha Saha and Micah Goldblum and Jonas Geiping and Tom Goldstein},
      year={2024},
      eprint={2401.12070},
      archivePrefix={arXiv},
      primaryClass={cs.CL}
}
```
