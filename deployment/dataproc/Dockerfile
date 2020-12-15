FROM ubuntu:20.04

RUN mkdir -p /usr/local/src
WORKDIR /usr/local/src

RUN apt update && apt install -y osmctools

COPY . /usr/local/src
