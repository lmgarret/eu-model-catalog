# Test fixtures

Trimmed to a few models per source.

| File | Origin |
|---|---|
| `bifrost-datasheet.json` | Recorded from https://getbifrost.ai/datasheet on 2026-10-22 |
| `models-dev.json` | Recorded from https://models.dev/api.json on 2026-10-22 |
| `greenpt.json` | Recorded from `GET https://api.greenpt.ai/v1/pricing` on 2026-10-22 |
| `regolo.json` | Recorded from `GET https://api.regolo.ai/model_group/info` on 2026-10-22 (`supported_openai_params` shortened) |
| `ecb.xml` | Recorded from the ECB daily reference rates on 2026-10-22 |
| `infomaniak.handwritten.json` | **Hand-written** from Infomaniak's OpenAPI spec. Replace with a captured response. |
| `mistral.handwritten.json` | **Hand-written** from Mistral's API docs. Replace with a captured response. |
| `epoch-eci.csv` | Recorded from https://epoch.ai/data/eci_scores.csv on 2026-10-23 |
| `epoch-benchmarks.csv` | Recorded from https://epoch.ai/data/eci_benchmarks.csv on 2026-10-23; the last row (`_low`) is **hand-written** |
| `lmarena.json` | Rows of LMArena's `text_style_control/latest` parquet, recorded on 2026-10-23 |
| `overlay/` | Overlay used by the snapshot test |
