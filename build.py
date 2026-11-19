#!/usr/bin/env python3
"""Build Ovrto: put src/ together into index.html and react-app.js (the files GitHub Pages serves).

  python3 build.py          write index.html and react-app.js from src/
  python3 build.py --check  fail if they are not what src/ builds (nothing is written)

src/index.html  the page, with markers: the tiny start-up script, the styles, the old app script
src/boot.js     tiny script in the page head (theme and language before first paint)
src/css/*.css   the styles, joined in name order
src/js/*.js     the old app script, joined in name order (the number in front sets the order).
                All these files run together inside one function, so they share one scope.
src/react/      the pages that moved to React (TypeScript). esbuild bundles main.tsx into react-app.js.

The build also stamps the page: a build number (so phones notice a new version and reload) and the
Content-Security-Policy hashes of the three inline scripts (the browser only runs inline scripts that match).
Needs Python 3 and esbuild (npm install, then it is in node_modules/.bin).
"""
import base64, glob, hashlib, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
OUT_HTML = os.path.join(ROOT, 'index.html')
OUT_REACT = os.path.join(ROOT, 'react-app.js')

def read(p):
    with open(p, encoding='utf-8', newline='') as f:
        return f.read()

def write(p, text):
    with open(p, 'w', encoding='utf-8', newline='') as f:
        f.write(text)

def join(pattern):
    files = sorted(glob.glob(os.path.join(SRC, pattern)))
    if not files:
        sys.exit(f'build: no files match src/{pattern}')
    return ''.join(read(f) for f in files)

def find_esbuild():
    for c in (os.path.join(ROOT, 'node_modules', '.bin', 'esbuild'), shutil.which('esbuild'), '/opt/npm-tools/node_modules/.bin/esbuild'):
        if c and os.path.exists(c):
            return c
    sys.exit('build: esbuild not found. Run: npm install')

def bundle_react():
    env = dict(os.environ)
    mods = [os.path.join(ROOT, 'node_modules'), '/opt/npm-tools/node_modules']  # where react is found
    env['NODE_PATH'] = os.pathsep.join([m for m in mods if os.path.isdir(m)])
    r = subprocess.run([find_esbuild(), os.path.join(SRC, 'react', 'main.tsx'), '--bundle', '--minify', '--format=iife', '--target=es2020',
                        '--jsx=automatic', '--legal-comments=none', '--log-level=warning', '--define:process.env.NODE_ENV="production"'],
                       capture_output=True, text=True, env=env, cwd=ROOT)
    if r.returncode != 0:
        sys.exit('build: React bundle failed\n' + r.stderr)
    return r.stdout

def build():
    page = read(os.path.join(SRC, 'index.html'))
    for marker, part in (('/*@include boot*/', 'boot.js'), ('/*@include css*/', 'css/*.css'), ('/*@include js*/', 'js/*.js')):
        if page.count(marker) != 1:
            sys.exit(f'build: src/index.html must contain {marker} exactly once')
        page = page.replace(marker, join(part))
    react = bundle_react()
    # build number: changes whenever anything the user runs changes
    stamp = hashlib.sha256((page + react).encode('utf-8')).hexdigest()[:12]
    page = page.replace('__BUILD__', stamp)
    # CSP: the sha256 of each inline script, in page order (start-up, opening screen, app)
    inline = [m.group(1) for m in re.finditer(r'<script>(.*?)</script>', page, re.S) if m.group(1)]
    if len(inline) != 3:
        sys.exit(f'build: expected 3 inline scripts, found {len(inline)}')
    for i, body in enumerate(inline, 1):
        page = page.replace(f'__CSP{i}__', base64.b64encode(hashlib.sha256(body.encode('utf-8')).digest()).decode())
    if re.search(r'__(BUILD|CSP\d)__', page):
        sys.exit('build: a stamp was not replaced')
    return page, react, stamp

def main():
    page, react, stamp = build()
    if '--check' in sys.argv:
        if not os.path.exists(OUT_HTML) or read(OUT_HTML) != page or not os.path.exists(OUT_REACT) or read(OUT_REACT) != react:
            sys.exit('build --check: index.html / react-app.js are out of date. Run: python3 build.py')
        print(f'up to date (build {stamp})')
        return
    write(OUT_HTML, page); write(OUT_REACT, react)
    print(f'built index.html {len(page.encode("utf-8")):,} bytes + react-app.js {len(react.encode("utf-8")):,} bytes (build {stamp})')

if __name__ == '__main__':
    main()
