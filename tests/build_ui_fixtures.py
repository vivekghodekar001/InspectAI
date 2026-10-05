"""Generate real model responses for the optional DOM regression suite."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app import app

client = app.test_client()
response = client.get('/api/status')
assert response.status_code == 200, response.get_data(as_text=True)
fixtures = {'status': response.get_json(), 'results': {}}
for sample in fixtures['status']['samples']:
    response = client.post('/api/inspect', json={'sample': sample['file']})
    assert response.status_code == 200, response.get_data(as_text=True)
    fixtures['results'][sample['file']] = response.get_json()
(ROOT / 'tests' / '.ui-fixtures.json').write_text(json.dumps(fixtures), encoding='utf-8')
print('Generated real model-response fixtures for UI tests.')
