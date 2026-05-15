# Optional convenience targets (Unix / Git Bash). Primary entry: npm run dev

.PHONY: dev up down logs

dev:
	npm run dev

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f
