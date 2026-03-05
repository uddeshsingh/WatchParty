#!/bin/bash

# --- CONFIGURATION ---
REDIS_ADDR="localhost:6379"
POSTGRES_URL="postgresql://postgres:postgres@localhost:5432/watchparty"

# 🚨 CHANGE THIS TO YOUR ACTUAL GOOGLE CLOUD PROJECT ID 🚨
GCP_PROJECT="watchparty-482106" 
GCP_TOPIC="watchparty-events"

# --- 1. ENVIRONMENT CLEANUP ---
echo "🧹 Unsetting Pub/Sub Emulator variables..."
unset PUBSUB_EMULATOR_HOST
# gcloud auth application-default login 

# --- 2. GO BACKEND TESTS ---
echo "🚀 Running Go Integration Tests (Redis + Live GCP)..."
cd backend-go || exit
# Pass the project ID to the tests using env vars
export GCP_PROJECT_ID=$GCP_PROJECT
go test ./internal/service/... -v
GO_EXIT=$?
cd ..

# --- 3. PYTHON BACKEND TESTS ---
echo "🐍 Running Python Integration Tests (Postgres + Live GCP)..."
cd backend-python || exit

# Activate Conda Environment
eval "$(conda shell.bash hook)"
conda activate wpenv

export DATABASE_URL=$POSTGRES_URL
export PYTHONPATH=.
pytest tests/test_integration.py -v
PY_EXIT=$?
conda deactivate
cd ..

# --- 4. FRONTEND UI TESTS ---
echo "⚛️ Running Frontend UI Tests (Vitest)..."
cd frontend/wpfe || exit
npm test -- --run
FE_EXIT=$?
cd ../..

# --- SUMMARY ---
echo "---------------------------------------"
echo "✅ Go Tests:     $([ $GO_EXIT -eq 0 ] && echo "PASSED" || echo "FAILED")"
echo "✅ Python Tests: $([ $PY_EXIT -eq 0 ] && echo "PASSED" || echo "FAILED")"
echo "✅ Frontend:     $([ $FE_EXIT -eq 0 ] && echo "PASSED" || echo "FAILED")"
echo "---------------------------------------"

if [ $GO_EXIT -eq 0 ] && [ $PY_EXIT -eq 0 ] && [ $FE_EXIT -eq 0 ]; then
  echo "🎊 ALL SYSTEMS NOMINAL!"
  exit 0
else
  echo "❌ Some tests failed. Check logs above."
  exit 1
fi