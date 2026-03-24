FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    fastapi==0.135.2 \
    uvicorn[standard]==0.34.0 \
    pydantic==2.12.5 \
    email-validator==2.3.0 \
    bcrypt==5.0.0 \
    PyJWT==2.12.1 \
    sqlalchemy==2.0.41 \
    psycopg2-binary==2.9.10 \
    boto3==1.38.18 \
    pytesseract==0.3.13 \
    openpyxl==3.1.5 \
    pdf2image==1.17.0 \
    Pillow==11.2.1 \
    google-genai==1.68.0 \
    openai==2.29.0

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
