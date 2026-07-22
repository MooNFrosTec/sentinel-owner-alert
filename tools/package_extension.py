#!/usr/bin/env python3
"""Build and validate a reproducible Chrome Web Store ZIP package."""

import json
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PACKAGE_FILES = (
    'manifest.json',
    'background.js',
    'content.js',
    'popup.html',
    'popup.js',
    'alert.wav',
    'icon16.png',
    'icon32.png',
    'icon48.png',
    'icon128.png',
)


def load_manifest() -> dict:
    with (ROOT / 'manifest.json').open(encoding='utf-8') as source:
        manifest = json.load(source)

    if manifest.get('manifest_version') != 3:
        raise SystemExit('manifest_version must be 3')
    if not manifest.get('version'):
        raise SystemExit('manifest version is missing')

    permissions = set(manifest.get('permissions', []))
    forbidden = permissions.intersection({'tabs', 'unlimitedStorage'})
    if forbidden:
        raise SystemExit(f'unexpected broad permissions: {sorted(forbidden)}')

    if manifest.get('host_permissions') != ['https://portal.azure.com/*']:
        raise SystemExit('host permissions must remain restricted to portal.azure.com')

    return manifest


def zip_info(name: str) -> zipfile.ZipInfo:
    info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o100644 << 16
    return info


def main() -> None:
    manifest = load_manifest()
    missing = [name for name in PACKAGE_FILES if not (ROOT / name).is_file()]
    if missing:
        raise SystemExit(f'missing package files: {missing}')

    dist = ROOT / 'dist'
    dist.mkdir(exist_ok=True)
    output = dist / f"sentinel-owner-alert-{manifest['version']}.zip"

    with zipfile.ZipFile(output, 'w') as archive:
        for name in PACKAGE_FILES:
            archive.writestr(zip_info(name), (ROOT / name).read_bytes())

    with zipfile.ZipFile(output) as archive:
        names = tuple(archive.namelist())
        if names != PACKAGE_FILES:
            raise SystemExit('package contents do not match the allowlist')
        packaged_manifest = json.loads(archive.read('manifest.json'))
        if packaged_manifest['version'] != manifest['version']:
            raise SystemExit('packaged manifest version mismatch')

    print(f'Created {output}')
    print(f'Files: {len(PACKAGE_FILES)}')
    print(f'Size: {output.stat().st_size} bytes')


if __name__ == '__main__':
    main()
