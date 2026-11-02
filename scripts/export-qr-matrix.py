"""QR fixture from our own payload; qrcode 8.2 uses the BSD licence."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / '.local' / 'export-python'))
import qrcode
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=4)
qr.add_data('Studio export fixture 2026-11-02')
qr.make(fit=True)
print(json.dumps(qr.get_matrix()))
