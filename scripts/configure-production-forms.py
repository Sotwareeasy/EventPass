"""Prepare the EventPass form fix beside an existing Docker Compose project.
Run in the Linux host that owns Docker; never reads or exports credentials.
"""
import argparse
from pathlib import Path
import subprocess
from urllib.parse import urlparse


def patch_template(source):
    replacements = [
        ('const response = await fetch(url.toString());',
         "const response = await fetch(url.toString(), { headers: { 'ngrok-skip-browser-warning': '1' } });"),
        ('const headers = {};',
         "const headers = { 'ngrok-skip-browser-warning': '1' };"),
    ]
    for old, new in replacements:
        if source.count(new) == 1 and old not in source:
            continue
        if source.count(old) != 1 or new in source:
            raise ValueError('Unexpected n8n template: review compatibility before updating.')
        source = source.replace(old, new, 1)
    return source


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--compose-dir', required=True)
    parser.add_argument('--public-url', required=True)
    parser.add_argument('--container', default='n8n-main')
    args = parser.parse_args()
    url = urlparse(args.public_url)
    if (url.scheme != 'https' or not url.hostname or url.username or url.password
            or url.port or url.path not in ('', '/') or url.query or url.fragment):
        parser.error('Use a public HTTPS origin without credentials, port or path.')
    directory = Path(args.compose_dir).resolve()
    if not (directory / 'docker-compose.yml').is_file():
        parser.error('docker-compose.yml was not found in compose-dir.')
    target = '/usr/local/lib/node_modules/n8n/templates/form-trigger.handlebars'
    source = subprocess.check_output(['docker', 'exec', args.container, 'cat', target], text=True)
    patched = patch_template(source)
    templates = directory / 'eventpass-templates'
    templates.mkdir(exist_ok=True)
    (templates / 'form-trigger.handlebars').write_text(patched, encoding='utf-8')
    public = 'https://' + url.hostname + '/'
    override = directory / 'compose.eventpass-forms.yml'
    override.write_text('services:\n  n8n:\n    environment:\n'
        + f'      WEBHOOK_URL: "{public}"\n      N8N_EDITOR_BASE_URL: "{public}"\n'
        + '    volumes:\n      - ./eventpass-templates/form-trigger.handlebars:' + target + ':ro\n'
        + '  n8n-worker:\n    environment:\n'
        + f'      WEBHOOK_URL: "{public}"\n      N8N_EDITOR_BASE_URL: "{public}"\n', encoding='utf-8')
    print('Prepared template and compose.eventpass-forms.yml. No containers restarted.')
    print('From compose-dir, validate and apply:')
    print('docker compose -f docker-compose.yml -f compose.eventpass-forms.yml config --quiet')
    print('docker compose -f docker-compose.yml -f compose.eventpass-forms.yml up -d --no-deps n8n n8n-worker')


if __name__ == '__main__':
    main()
