"""Structured PDF operations. Never patch raw PDF bytes or rely on xref repair."""
import hashlib
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / '.local' / 'export-python'))
import pikepdf


def walk_streams(pdf, callback):
    visited = set()

    def walk(target, resources):
        key = target.obj.objgen if isinstance(target, pikepdf.Page) else target.objgen
        if key != (0, 0) and key in visited:
            return
        visited.add(key)
        callback(target, resources)
        for obj in resources.get('/XObject', {}).values():
            if obj.get('/Subtype') == pikepdf.Name.Form:
                walk(obj, obj.get('/Resources', resources))

    for page in pdf.pages:
        walk(page, page.get('/Resources', pikepdf.Dictionary()))


def map_k(k, curve):
    for (x0, y0), (x1, y1) in zip(curve, curve[1:]):
        if x0 <= k <= x1:
            return y0 + (k - x0) / (x1 - x0) * (y1 - y0)
    raise ValueError('neutralCurve does not cover colour')


def rewrite(pdf, curve):
    count = 0

    def stream(target, resources):
        nonlocal count
        spaces = ['DeviceGray', 'DeviceGray']
        stack, output = [], []
        for instruction in pikepdf.parse_content_stream(target):
            if isinstance(instruction, pikepdf.ContentStreamInlineImage):
                raise ValueError('unsupported inline image')
            operands, operator = instruction
            op = str(operator)
            if op == 'q':
                stack.append(spaces.copy())
            elif op == 'Q':
                if not stack:
                    raise ValueError('unbalanced graphics state')
                spaces = stack.pop()
            elif op in ('cs', 'CS'):
                space = str(operands[0]).lstrip('/')
                if space not in ('DeviceRGB', 'DeviceGray', 'DeviceCMYK'):
                    raise ValueError('unsupported vector colour space: ' + space)
                spaces[op == 'CS'] = space
            elif op == 'gs':
                gs = resources.get('/ExtGState', {}).get(operands[0], {})
                if float(gs.get('/ca', 1)) != 1 or float(gs.get('/CA', 1)) != 1 or str(gs.get('/BM', '/Normal')) != '/Normal' or str(gs.get('/SMask', '/None')) != '/None':
                    raise ValueError('unsupported transparency in neutral rewrite')
                if gs.get('/OP', False) or gs.get('/op', False):
                    raise ValueError('unsupported overprint; use knockout')
            elif op == 'sh':
                raise ValueError('unsupported vector shading in neutral rewrite')

            selected = None
            if op in ('rg', 'RG', 'g', 'G', 'sc', 'SC', 'scn', 'SCN'):
                stroke = op in ('RG', 'G', 'SC', 'SCN')
                space = ('DeviceRGB' if op in ('rg', 'RG') else 'DeviceGray' if op in ('g', 'G') else spaces[stroke])
                values = [float(v) for v in operands]
                expected = {'DeviceRGB': 3, 'DeviceGray': 1, 'DeviceCMYK': 4}[space]
                if len(values) != expected or any(v < 0 or v > 1 for v in values):
                    raise ValueError('unsupported colour operands')
                # Convert device-space sc/scn to direct operators so a previous rewritten k cannot change their meaning.
                direct = {'DeviceRGB': 'rg', 'DeviceGray': 'g', 'DeviceCMYK': 'k'}[space]
                direct = direct.upper() if stroke else direct
                selected = (values, pikepdf.Operator(direct))
                if space in ('DeviceRGB', 'DeviceGray') and max(values) - min(values) <= 0.00001:
                    gray = values[0]
                    if gray < 1:  # Preserve white; never apply a tint curve to white.
                        selected = ([0, 0, 0, map_k(1 - gray, curve)], pikepdf.Operator('K' if stroke else 'k'))
                        count += 1
                if op in ('rg', 'RG', 'g', 'G'):
                    spaces[stroke] = space
            elif op in ('k', 'K'):
                spaces[op == 'K'] = 'DeviceCMYK'
            output.append(selected or instruction)
        if stack:
            raise ValueError('unbalanced graphics state')
        data = pikepdf.unparse_content_stream(output)
        if isinstance(target, pikepdf.Page):
            target.Contents = pdf.make_stream(data)
        else:
            target.write(data)

    walk_streams(pdf, stream)
    return count


def inspect(pdf):
    colours, fonts, images = [], {}, []

    def stream(target, resources):
        spaces, stack = ['DeviceGray', 'DeviceGray'], []
        for instruction in pikepdf.parse_content_stream(target):
            if isinstance(instruction, pikepdf.ContentStreamInlineImage):
                continue
            operands, operator = instruction
            op = str(operator)
            if op == 'q':
                stack.append(spaces.copy())
            elif op == 'Q':
                spaces = stack.pop()
            elif op in ('cs', 'CS'):
                space = str(operands[0]).lstrip('/')
                if space not in ('DeviceGray', 'DeviceRGB', 'DeviceCMYK'):
                    definition = resources.get('/ColorSpace', {}).get(operands[0])
                    if definition is not None and str(definition[0]) == '/ICCBased':
                        space = {1: 'DeviceGray', 3: 'DeviceRGB', 4: 'DeviceCMYK'}.get(int(definition[1].get('/N', 0)), 'Unknown')
                spaces[op == 'CS'] = space
            if op in ('rg', 'RG', 'g', 'G', 'k', 'K', 'sc', 'SC', 'scn', 'SCN'):
                normalized = op
                if op in ('sc', 'SC', 'scn', 'SCN'):
                    normalized = {'DeviceRGB': 'rg', 'DeviceGray': 'g', 'DeviceCMYK': 'k'}.get(spaces[op.isupper()], 'unknown')
                    if op.isupper():
                        normalized = normalized.upper()
                colours.append({'operator': normalized, 'values': [float(v) for v in operands]})
        for font in resources.get('/Font', {}).values():
            for leaf in font.get('/DescendantFonts', [font]):
                name = str(leaf.get('/BaseFont', font.get('/BaseFont', '/unknown'))).lstrip('/')
                descriptor = leaf.get('/FontDescriptor', {})
                fonts[name] = {'name': name, 'embedded': any(k in descriptor for k in ('/FontFile', '/FontFile2', '/FontFile3')),
                               'subset': len(name) > 7 and name[6] == '+' and name[:6].isupper()}
        for image in resources.get('/XObject', {}).values():
            if image.get('/Subtype') == pikepdf.Name.Image:
                space = image.get('/ColorSpace', '/Unknown')
                if isinstance(space, pikepdf.Array) and str(space[0]) == '/ICCBased':
                    space = {1: '/DeviceGray', 3: '/DeviceRGB', 4: '/DeviceCMYK'}.get(int(space[1].get('/N', 0)), '/Unknown')
                images.append({'colourSpace': str(space), 'width': int(image.Width), 'height': int(image.Height)})

    walk_streams(pdf, stream)
    intents = []
    for intent in pdf.Root.get('/OutputIntents', []):
        data = intent.get('/DestOutputProfile')
        intents.append({'type': str(intent.get('/S', '')), 'identifier': str(intent.get('/OutputConditionIdentifier', '')),
                        'iccSha256': hashlib.sha256(data.read_bytes()).hexdigest() if data is not None else None})
    return {'syntaxWarnings': pdf.check_pdf_syntax(), 'pages': [
        {key: [float(v) for v in page.get('/' + key, [])] for key in ('MediaBox', 'TrimBox', 'BleedBox')} for page in pdf.pages],
        'colours': colours, 'fonts': list(fonts.values()), 'images': images, 'outputIntents': intents,
        'pdfx': str(pdf.docinfo.get('/GTS_PDFXVersion', ''))}


def main():
    action, source = sys.argv[1:3]
    with pikepdf.open(source, attempt_recovery=False) as pdf:
        if action == 'rewrite':
            config = json.loads(Path(sys.argv[4]).read_text(encoding='utf-8'))
            count = rewrite(pdf, config['neutralCurve'])
            pdf.save(sys.argv[3])
            result = {'rewritten': count}
        elif action == 'boxes':
            # pdfwrite serializes page dimensions to 0.01pt. Use the same precision for all boxes
            # so a sub-centipoint TrimBox excess cannot trigger PDF/X fallback.
            width, height = (round(float(v), 2) for v in sys.argv[4:6])
            for page in pdf.pages:
                old = [float(v) for v in page.MediaBox]
                # Chromium rounds sheet dimensions. PDF uses a bottom origin; changing only
                # MediaBox would shift every top-origin element when rasterized on the new sheet.
                page.contents_add(f'q 1 0 0 1 {-old[0]:.6f} {height - old[3]:.6f} cm\n'.encode(), prepend=True)
                page.contents_add(b'\nQ\n')
                page.MediaBox = pikepdf.Array([0, 0, width, height])
                page.CropBox = pikepdf.Array(page.MediaBox)
                page.TrimBox = pikepdf.Array(page.MediaBox)
                page.BleedBox = pikepdf.Array(page.MediaBox)
            pdf.save(sys.argv[3])
            result = {'pages': len(pdf.pages)}
        elif action == 'inspect':
            result = inspect(pdf)
        else:
            raise ValueError('unknown PDF operation')
        warnings = pdf.get_warnings()
        if warnings:
            raise ValueError('; '.join(warnings))
        print(json.dumps(result))


if __name__ == '__main__':
    main()
