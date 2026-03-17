#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Label Studio — Automated Backup Script
# ─────────────────────────────────────────────────────────────
# Backs up:
#   1. PostgreSQL database (pg_dump)
#   2. Label Studio uploaded files (/label-studio/data)
#
# Runs on a loop with configurable interval and retention.
# ─────────────────────────────────────────────────────────────

set -e

BACKUP_DIR="/backups"
INTERVAL="${BACKUP_INTERVAL:-21600}"    # default 6 hours
RETENTION="${BACKUP_RETENTION:-10}"     # keep last N backups

echo "╔══════════════════════════════════════════════════╗"
echo "║  Label Studio Backup Service                    ║"
echo "║  Interval : ${INTERVAL}s                        ║"
echo "║  Retention: last ${RETENTION} backups           ║"
echo "╚══════════════════════════════════════════════════╝"

mkdir -p "${BACKUP_DIR}"

run_backup() {
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_NAME="ls_backup_${TIMESTAMP}"
    BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

    mkdir -p "${BACKUP_PATH}"

    echo ""
    echo "──────────────────────────────────────────"
    echo "[$(date)] Starting backup: ${BACKUP_NAME}"
    echo "──────────────────────────────────────────"

    # 1. Backup PostgreSQL
    echo "[1/2] Dumping PostgreSQL database..."
    if PGPASSWORD="${POSTGRESQL_PASSWORD}" pg_dump \
        -h "${POSTGRESQL_HOST}" \
        -p "${POSTGRESQL_PORT}" \
        -U "${POSTGRESQL_USER}" \
        -d "${POSTGRESQL_NAME}" \
        -F c \
        -f "${BACKUP_PATH}/database.dump" 2>/dev/null; then
        echo "  ✓ Database dump completed"
    else
        echo "  ✗ Database dump failed (PostgreSQL might not be ready)"
    fi

    # 2. Backup Label Studio uploaded files
    echo "[2/2] Backing up Label Studio data files..."
    if [ -d "/label-studio-data" ]; then
        tar -czf "${BACKUP_PATH}/ls_data.tar.gz" -C /label-studio-data . 2>/dev/null
        echo "  ✓ Data files backup completed"
    else
        echo "  ⚠ No Label Studio data directory found, skipping"
    fi

    # Calculate backup size
    BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" 2>/dev/null | cut -f1)
    echo ""
    echo "✓ Backup completed: ${BACKUP_NAME} (${BACKUP_SIZE})"

    # 3. Cleanup old backups (keep last N)
    BACKUP_COUNT=$(ls -1d "${BACKUP_DIR}"/ls_backup_* 2>/dev/null | wc -l)
    if [ "${BACKUP_COUNT}" -gt "${RETENTION}" ]; then
        REMOVE_COUNT=$((BACKUP_COUNT - RETENTION))
        echo "  Removing ${REMOVE_COUNT} old backup(s)..."
        ls -1d "${BACKUP_DIR}"/ls_backup_* | head -n "${REMOVE_COUNT}" | xargs rm -rf
        echo "  ✓ Cleanup done"
    fi

    echo "──────────────────────────────────────────"
}

# Run first backup immediately
echo ""
echo "Running initial backup..."
run_backup

# Then loop
while true; do
    echo ""
    echo "Next backup in ${INTERVAL} seconds..."
    sleep "${INTERVAL}"
    run_backup
done
