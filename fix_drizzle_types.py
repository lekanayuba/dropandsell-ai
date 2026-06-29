import json, os

with open('node_modules/drizzle-orm/package.json', 'r') as f:
    data = json.load(f)

exports = data.get('exports', {})

def fix_import_types(exports_obj, path=''):
    for key, value in list(exports_obj.items()):
        current_path = f'{path}.{key}' if path else key
        if isinstance(value, dict):
            if 'import' in value and isinstance(value['import'], dict):
                imp = value['import']
                if 'types' in imp and imp['types'].endswith('.d.ts'):
                    ts_file = os.path.join('node_modules/drizzle-orm', imp['types'])
                    if not os.path.exists(ts_file):
                        cts_file = ts_file.replace('.d.ts', '.d.cts')
                        if os.path.exists(cts_file):
                            imp['types'] = imp['types'].replace('.d.ts', '.d.cts')
                            print(f'Fixed: {current_path} -> {imp["types"]}')
            fix_import_types(value, current_path)

fix_import_types(exports)

with open('node_modules/drizzle-orm/package.json', 'w') as f:
    json.dump(data, f, indent=2)

print('Done')
