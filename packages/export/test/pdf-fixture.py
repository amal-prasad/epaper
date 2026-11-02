"""Synthetic PDF fixtures for the structured colour integration tests."""
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / '.local' / 'export-python'))
import pikepdf

output, kind = sys.argv[1:]
pdf = pikepdf.Pdf.new()
page = pdf.add_blank_page(page_size=(200, 200))
stream = b'0 0 0 rg 10 10 20 20 re f .85 .85 .85 rg 40 10 20 20 re f 1 1 1 rg 70 10 20 20 re f 1 0 0 rg 100 10 20 20 re f'
if kind == 'form':
    form = pdf.make_stream(stream)
    form.Type = pikepdf.Name.XObject
    form.Subtype = pikepdf.Name.Form
    form.BBox = pikepdf.Array([0, 0, 200, 200])
    form.Resources = pikepdf.Dictionary()
    page.Resources = pikepdf.Dictionary(XObject=pikepdf.Dictionary(F1=form))
    stream = b'q /F1 Do Q'
elif kind == 'gray':
    stream = b'0 g 10 10 20 20 re f .85 G 10 40 m 60 40 l S'
elif kind == 'spaces':
    stream = b'/DeviceRGB cs 0 0 0 scn 10 10 20 20 re f 1 0 0 scn 40 10 20 20 re f'
elif kind == 'unsupported':
    stream = b'/Unknown cs 0 0 0 scn 10 10 20 20 re f'
elif kind == 'alpha':
    page.Resources = pikepdf.Dictionary(ExtGState=pikepdf.Dictionary(A=pikepdf.Dictionary(ca=0.5)))
    stream = b'/A gs 0 0 0 rg 10 10 20 20 re f'
elif kind == 'thin-rich':
    stream = b'0 0 0 1 k 10 10 150 150 re f .4 .4 .4 .8 k 170 170 1 1 re f'
page.Contents = pdf.make_stream(stream)
pdf.save(output)
