import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL = "gemini-2.5-flash"

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

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
    )

    return response.text