FROM python:3.9-slim

# Install dependencies
RUN pip install --no-cache-dir flask==2.3.0 gunicorn==20.1.0

# Copy serving script
COPY serve.py /opt/ml/code/serve.py

# Set working directory
WORKDIR /opt/ml/code

# Expose port
EXPOSE 8080

# Start server
ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--timeout", "60", "serve:app"]
