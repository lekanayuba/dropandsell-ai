import os, glob, re

root = 'node_modules/drizzle-orm'
count = 0

for dcts_file in glob.glob(f'{root}/**/*.d.cts', recursive=True):
    dts_file = dcts_file.replace('.d.cts', '.d.ts')
    if os.path.exists(dts_file):
        continue
    with open(dcts_file, 'r', encoding='utf-8') as f:
        content = f.read()
    # Replace .cjs extensions in import/export paths with .js
    content = content.replace('.cjs', '.js')
    with open(dts_file, 'w', encoding='utf-8') as f:
        f.write(content)
    count += 1

print(f'Converted {count} .d.cts files to .d.ts')
