function parsePositiveInteger(value) {
  const normalized = String(value ?? '').trim();

  if (!/^[1-9]\d*$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
}

function normalizeScore(value) {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function escapeCsvCell(value) {
  const stringValue = value == null ? '' : String(value);
  const escaped = stringValue.replace(/"/g, '""');

  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function toCsv(headers, rows) {
  const lines = [
    headers.map((header) => escapeCsvCell(header.label)).join(','),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvCell(row[header.key])).join(',')
    ),
  ];

  return `\uFEFF${lines.join('\n')}`;
}

function sendError(res, statusCode, error) {
  res.status(statusCode).json({ ok: false, error });
}

module.exports = {
  normalizeScore,
  parsePositiveInteger,
  sendError,
  toCsv,
};
