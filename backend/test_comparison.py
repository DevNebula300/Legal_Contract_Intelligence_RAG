from app.core.comparision_agent import compare_contracts
import json

result = compare_contracts(
    "a53bc1ec-a9bb-49fa-b29d-5fce6e60f37c",
    "7b4a71ec-20f2-45ab-8681-be96c4b26414"
)
print(json.dumps(result, indent=2))
