"""Read bytes only. Never extract an archive or execute its contents."""
import hashlib, json, pathlib, sys, tarfile
expected=json.load(sys.stdin)
if not isinstance(expected,dict) or len(expected)>1024: raise ValueError('manifest rejected')
found={}
with tarfile.open(sys.argv[1], 'r:gz') as archive:
    for member in archive:
        name=member.name.removeprefix('./')
        path=pathlib.PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or member.issym() or member.islnk(): raise ValueError('archive member rejected')
        if not name.startswith('dist/client/'): continue
        public='public/'+name[len('dist/client/'):]
        if public not in expected: continue
        if not member.isfile() or public in found or member.size>64*1024*1024: raise ValueError('archive asset rejected')
        stream=archive.extractfile(member)
        digest=hashlib.sha256()
        for chunk in iter(lambda:stream.read(65536),b''): digest.update(chunk)
        found[public]=digest.hexdigest()
if found!=expected: raise ValueError('archive public bytes mismatch')
print(json.dumps({'archivePublicExact':True,'publicFiles':len(found)}))
