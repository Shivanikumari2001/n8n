#!/bin/bash

# Generate n8n encryption key
echo "Generating n8n encryption key..."
ENCRYPTION_KEY=$(openssl rand -base64 32)

echo ""
echo "=========================================="
echo "Generated Encryption Key:"
echo "=========================================="
echo "$ENCRYPTION_KEY"
echo "=========================================="
echo ""
echo "Add this to your .env file as:"
echo "N8N_ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""
echo "⚠️  Keep this key secure and backed up!"
echo "   Without it, you won't be able to decrypt your workflows!"

