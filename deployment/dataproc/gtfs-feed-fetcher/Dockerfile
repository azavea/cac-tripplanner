FROM python:2

RUN mkdir -p /usr/local/src
WORKDIR /usr/local/src

COPY requirements.txt /usr/local/src/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /usr/local/src
