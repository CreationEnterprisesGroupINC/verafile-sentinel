#!/bin/bash

echo ""
echo "OCP 30-Second Demo"
echo "If one byte changes, verification fails."
echo ""

echo "Step 1: Verifying original file..."
node ../../reference-cli/verify.js original.txt proof.json

echo ""
echo "Step 2: Verifying tampered file..."
node ../../reference-cli/verify.js tampered.txt proof.json
