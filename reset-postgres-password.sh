#!/bin/bash

# Script to reset PostgreSQL password on macOS (Homebrew)
# This will reset the password for the 'postgres' user to 'postgres'

echo "========================================="
echo "PostgreSQL Password Reset Script"
echo "========================================="
echo ""
echo "This will reset the 'postgres' user password to 'postgres'"
echo ""

# Detect PostgreSQL version and data directory
PG_VERSION=""
PG_DATA_DIR=""

# Try to find PostgreSQL data directory
for version in 14 15 16; do
    if [ -d "/opt/homebrew/var/postgresql@$version" ]; then
        PG_VERSION="$version"
        PG_DATA_DIR="/opt/homebrew/var/postgresql@$version"
        break
    elif [ -d "/usr/local/var/postgresql@$version" ]; then
        PG_VERSION="$version"
        PG_DATA_DIR="/usr/local/var/postgresql@$version"
        break
    elif [ -d "$HOME/Library/Application Support/Postgres/var-$version" ]; then
        PG_VERSION="$version"
        PG_DATA_DIR="$HOME/Library/Application Support/Postgres/var-$version"
        break
    fi
done

if [ -z "$PG_DATA_DIR" ]; then
    echo "Error: Could not find PostgreSQL data directory."
    echo ""
    echo "Please run these commands manually:"
    echo "1. brew services stop postgresql@14  (or your version)"
    echo "2. Find your data directory: brew info postgresql@14"
    echo "3. /opt/homebrew/opt/postgresql@14/bin/postgres --single -D [DATA_DIR] postgres"
    echo "4. Type: ALTER USER postgres WITH PASSWORD 'postgres';"
    echo "5. Press Ctrl+D"
    echo "6. brew services start postgresql@14"
    exit 1
fi

echo "Found PostgreSQL $PG_VERSION"
echo "Data directory: $PG_DATA_DIR"
echo ""

read -p "Continue with password reset? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
fi

# Get PostgreSQL bin directory
PG_BIN=$(brew --prefix postgresql@$PG_VERSION)/bin

echo ""
echo "Step 1: Stopping PostgreSQL..."
brew services stop postgresql@$PG_VERSION 2>/dev/null || brew services stop postgresql 2>/dev/null

sleep 2

echo "Step 2: Resetting password..."
echo "ALTER USER postgres WITH PASSWORD 'postgres';" | $PG_BIN/postgres --single -D "$PG_DATA_DIR" postgres

echo ""
echo "Step 3: Restarting PostgreSQL..."
brew services start postgresql@$PG_VERSION 2>/dev/null || brew services start postgresql 2>/dev/null

sleep 2

echo ""
echo "========================================="
echo "Password reset complete!"
echo "========================================="
echo ""
echo "You can now connect using:"
echo "  psql -U postgres"
echo ""
echo "Password: postgres"
echo ""
echo "To create the database:"
echo "  createdb -U postgres finance_tracker"
echo ""

