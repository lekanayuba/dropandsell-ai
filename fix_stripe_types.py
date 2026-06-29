import json

with open('node_modules/stripe-replit-sync/package.json', 'r') as f:
    data = json.load(f)

exports = data.get('exports', {})
if 'import' in exports and 'types' in exports['import']:
    old = exports['import']['types']
    new = old.replace('.d.ts', '.d.cts')
    exports['import']['types'] = new
    print(f'Fixed: {old} -> {new}')

    with open('node_modules/stripe-replit-sync/package.json', 'w') as f:
        json.dump(data, f, indent=2)
else:
    print('Unexpected structure')
    print(json.dumps(exports, indent=2))
