"""Create a UTF-8 Windows ZIP containing the complete app, never a user library."""
import argparse
import os
from pathlib import Path
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--program', required=True)
parser.add_argument('--output', required=True)
parser.add_argument('--folder', required=True)
args = parser.parse_args()
program = Path(args.program).resolve()
output = Path(args.output).resolve()
if not (program / '笑食天下.exe').is_file() or not (program / 'resources/app.asar').is_file():
    raise SystemExit('The program folder is incomplete.')
output.parent.mkdir(parents=True, exist_ok=True)
temporary = output.with_suffix('.zip.tmp')
try:
    with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for source in sorted(program.rglob('*')):
            if source.is_file():
                if source.name == '菜单资料.json' or any(p in {'照片', '自动备份', '运行缓存'} for p in source.relative_to(program).parts):
                    raise RuntimeError('Refusing to package a personal library.')
                archive.write(source, Path(args.folder) / source.relative_to(program))
    with zipfile.ZipFile(temporary) as archive:
        if archive.testzip() is not None:
            raise RuntimeError('ZIP integrity check failed.')
    os.replace(temporary, output)
finally:
    temporary.unlink(missing_ok=True)
print(f'Created {output.name} ({output.stat().st_size / 1024 / 1024:.1f} MiB)')
