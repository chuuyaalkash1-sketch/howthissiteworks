FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY . /app
ARG SERVICE
ENV SERVICE=${SERVICE}
CMD ["uvicorn", "observability.main:app", "--host", "0.0.0.0", "--port", "10000"]