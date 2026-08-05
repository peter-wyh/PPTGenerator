import re, os, glob

base = '/Users/ap/Desktop/PPTGenerator'
dirs = [
    'apps/web/src/editor/components',
    'apps/web/src/editor/components/report',
]
files = []
for d in dirs:
    p = os.path.join(base, d)
    files.extend(glob.glob(os.path.join(p, '**', '*.tsx'), recursive=True))

mapping = {
    'gap-1': 'skin-gap-xs',
    'gap-2': 'skin-gap-sm',
    'gap-3': 'skin-gap-md',
    'gap-4': 'skin-gap-lg',
}
total = 0
changed_files = 0
for f in files:
    with open(f, 'r') as fh:
        content = fh.read()
    orig = content
    for old, new in mapping.items():
        pat = re.escape(old)
        # preceded by space or quote, followed by space or quote
        content = re.sub(r'(?<=[ "])' + pat + r'(?=[ "])', new, content)
    if content != orig:
        diff = sum(1 for o, n in zip(orig.splitlines(), content.splitlines()) if o != n)
        total += diff
        changed_files += 1
        with open(f, 'w') as fh:
            fh.write(content)
        print(f'  {os.path.basename(f)}: {diff} lines')
print(f'Total: {total} lines in {changed_files} files')
