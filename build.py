#!/usr/bin/env python3
"""Build Ovrto: put src/ back together into index.html (the file GitHub Pages serves).

  python3 build.py          rebuild index.html from src/
  python3 build.py --check  fail if index.html is not what src/ builds (nothing is written)

src/index.html  the page, with three markers: the tiny start-up script, the styles, the app script
src/boot.js     tiny script in the page head (theme and language before first paint)
src/css/*.css   the styles, joined in name order
src/js/*.js     the app script, joined in name order (the number in front sets the order)

All the js files run together inside one function, so they share one scope:
a function written in one file can be used in any other file.
Only the Python standard library is needed.
"""
import glob, hashlib, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'index.html')

def read(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()

def join(pattern):
    files = sorted(glob.glob(os.path.join(SRC, pattern)))
    if not files:
        sys.exit(f'build: no files match src/{pattern}')
    return ''.join(read(f) for f in files)

def build():
    page = read(os.path.join(SRC, 'index.html'))
    for marker, part in (('/*@include boot*/', 'boot.js'), ('/*@include css*/', 'css/*.css'), ('/*@include js*/', 'js/*.js')):
        if page.count(marker) != 1:
            sys.exit(f'build: src/index.html must contain {marker} exactly once')
        page = page.replace(marker, join(part))
    return page

def main():
    page = build()
    digest = hashlib.sha256(page.encode('utf-8')).hexdigest()[:12]
    if '--check' in sys.argv:
        if not os.path.exists(OUT) or read(OUT) != page:
            sys.exit('build --check: index.html is out of date. Run: python3 build.py')
        print(f'index.html matches src/ ({digest})')
        return
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(page)
    print(f'built index.html: {len(page.encode("utf-8")):,} bytes ({digest})')

if __name__ == '__main__':
    main()
