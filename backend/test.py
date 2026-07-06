import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY not found in .env")

client = genai.Client(api_key=api_key)


context = """
Heading: Termination
Page: 8

Either party may terminate this Agreement by giving
30 days written notice to the other party.

Heading: Governing Law
Page: 12

This Agreement shall be governed by the laws of Pakistan.
"""

question = "How is governing the agreement?"

prompt = f"""
You are an AI Legal Contract Assistant.

Answer ONLY using the context below.

If the answer is not present, say:
"I couldn't find that information in the provided contract."

Context:
{context}

Question:
{question}

Also mention which heading the answer came from.
"""

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt
)

print("\nQuestion:")
print(question)

print("\nAnswer:")
print(response.text)