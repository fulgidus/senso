FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi==0.135.2 \
    uvicorn[standard]==0.34.0 \
    pydantic==2.12.5 \
    email-validator==2.3.0 \
    bcrypt==5.0.0 \
    PyJWT==2.12.1

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
