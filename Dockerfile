# Gunakan Python 3.9 sebagai base image
FROM python:3.10

# Set folder kerja di dalam container
WORKDIR /app

# Copy file requirements.txt dari folder backend ke dalam container
COPY backend/requirements.txt /app/requirements.txt

# Install dependencies
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

# Copy seluruh isi folder backend ke dalam container
COPY backend /app/backend

# Buat user baru (Hugging Face menyarankan tidak pakai root user)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
	PATH=/home/user/.local/bin:$PATH

# Set working directory ke folder tempat main.py berada (opsional, tapi biar aman path-nya)
WORKDIR /app

# Jalankan perintah untuk menyalakan server
# PENTING: Hugging Face Spaces secara default menggunakan PORT 7860
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]