import os
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

client = Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY")
)
MODEL = "claude-sonnet-5"
def generate_answer(question: str, context: str) -> str:
    prompt = f"""
You are an AI legal contract assistant.

Answer ONLY using the provided contract excerpts.

If the answer is not in the excerpts, reply:
"I couldn't find that information in the contract."

Contract Excerpts:
{context}
Question:
{question}
Provide a concise answer and mention the relevant clause heading if possible.
"""
    response = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
    )

    return response.content[0].text