import os
from binoculars import Binoculars

# Prefer the small Falcon models by default to avoid 7B downloads on low disk.
use_small = os.environ.get("BINOCULARS_SMALL_MODELS", "1") == "1"

if use_small:
	bino = Binoculars(
		observer_name_or_path="tiiuae/falcon-rw-1b",
		performer_name_or_path="tiiuae/falcon-rw-1b",
		use_bfloat16=True,
		mode="accuracy",
	)
else:
	bino = Binoculars(mode="accuracy")

# Simple smoke test (kept lightweight; feel free to comment out)
sample_string = "This is a short test sentence to verify the detector loads."
print(bino.predict(sample_string))
