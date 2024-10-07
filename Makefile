# Makefile for various tasks

.PHONY: benchmark-build
benchmark-build:
	bun build benchmark/stream.benchmark.ts --outfile=benchmark/benchmark.js
