#!/usr/bin/env sh
if command -v python3 >/dev/null 2>&1; then
	PYTHON=python3
elif command -v python >/dev/null 2>&1; then
	PYTHON=python
else 
	echo "Neither 'python' nor 'python3' was found. Please install Python 3 package." >&2
	exit 1
fi

firefox http://localhost:8000

$PYTHON -m http.server 8000


