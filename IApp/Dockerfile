FROM python:3.13.3-alpine3.21
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY . .
ENTRYPOINT ["python3", "/app/src/app.py"]
