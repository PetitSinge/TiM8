#!/bin/bash

echo "🧪 Testing Workspace API functionality"

# Test 1: Get existing workspaces
echo "1. Getting existing workspaces..."
curl -s http://localhost:3000/api/workspaces | jq '.'

echo -e "\n2. Creating a new workspace..."
# Test 2: Create a workspace
curl -s -X POST http://localhost:3000/api/workspaces/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Workspace", "description":"Test description", "clusters":[]}' | jq '.'

echo -e "\n3. Getting workspaces again to see the new one..."
curl -s http://localhost:3000/api/workspaces | jq '.'

echo -e "\nTest completed!"