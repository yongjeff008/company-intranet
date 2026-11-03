#!/usr/bin/env python3
"""Exercise real HTTP endpoints and MySQL transactions in an isolated disposable database."""
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import shlex
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:5099'

class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(self.cookies))
        self.csrf = ''

    def request(self, path, data=None, method='GET', expected=200, raw=None, content_type=None, csrf=True):
        headers = {}
        if method != 'GET' and csrf:
            headers['X-CSRF-TOKEN'] = self.csrf
        if data is not None:
            raw = json.dumps(data).encode()
            headers['Content-Type'] = 'application/json'
        if content_type:
            headers['Content-Type'] = content_type
        request = urllib.request.Request(BASE + '/api' + path, data=raw, headers=headers, method=method)
        try:
            response = self.opener.open(request, timeout=15)
        except urllib.error.HTTPError as e:
            response = e
        body = response.read()
        try:
            result = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            result = body.decode(errors='replace')
        assert response.code == expected, f'{method} {path}: expected {expected}, got {response.code}: {str(result)[:400]}'
        return result

    def session(self):
        result = self.request('/auth/session')
        self.csrf = result['csrfToken']
        return result

    def login(self, username, password):
        self.session()
        self.request('/auth/login', {'username': username, 'password': password}, 'POST')
        return self.session()['user']


def sql(statement):
    subprocess.run(['docker', 'compose', 'exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'], input=statement.encode(), cwd=ROOT, check=True, stdout=subprocess.DEVNULL)


def run():
    env = os.environ.copy()
    for line in (ROOT / '.env').read_text().splitlines():
        if line and not line.startswith('#'):
            key, value = line.split('=', 1)
            env[key] = shlex.split(value)[0]
    database = 'intranet_test_' + secrets.token_hex(4)
    sql(f"CREATE DATABASE `{database}` CHARACTER SET utf8mb4; GRANT ALL ON `{database}`.* TO 'intranet'@'%';")
    admin_password, editor_password = secrets.token_urlsafe(20), secrets.token_urlsafe(20)
    env.update(ConnectionStrings__Cms=env['ConnectionStrings__Cms'].replace('Database=intranet;', f'Database={database};'), CMS_BOOTSTRAP_PASSWORD=admin_password, CMS_DATA_PATH=str(ROOT / '.data' / database), ASPNETCORE_URLS=BASE, ASPNETCORE_ENVIRONMENT='Development', DOTNET_ROOT=str(ROOT / '.tools/dotnet'))
    logpath = ROOT / '.data' / 'integration.log'
    logpath.parent.mkdir(exist_ok=True)
    with logpath.open('w') as log:
        process = subprocess.Popen([str(ROOT / '.tools/dotnet/dotnet'), str(ROOT / 'src/Intranet.Api/bin/Debug/net10.0/Intranet.Api.dll')], cwd=ROOT / 'src/Intranet.Api', env=env, stdout=log, stderr=subprocess.STDOUT)
        try:
            admin = Client()
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError('API exited during startup; see .data/integration.log')
                try:
                    admin.request('/health')
                    break
                except (OSError, AssertionError):
                    time.sleep(.2)
            else:
                raise RuntimeError('API startup timed out')
            Client().request('/portal/content', expected=401)
            Client().request('/auth/login', {'username': 'admin', 'password': admin_password}, 'POST', expected=400, csrf=False)
            admin.login('admin', admin_password)
            assert admin.request('/portal/content') == [], 'No fake business content should be seeded'
            assert admin.request('/portal/pages/home')['modules'] == []
            depts = []
            for name in ['行政管理部', '人才发展部']:
                depts.append(admin.request('/it/departments', {'name': name, 'description': name + '的工作空间', 'active': True, 'sortOrder': len(depts)}, 'POST')['id'])
            for username, role, grants in [('alice', 'editor', [{'departmentId': depts[0], 'canViewResults': True}]), ('bob', 'editor', [{'departmentId': depts[1], 'canViewResults': False}]), ('reader', 'reader', []), ('ituser', 'it', [])]:
                admin.request('/it/users', {'username': username, 'name': {'alice': '行政编辑', 'bob': '人才编辑', 'reader': '普通员工', 'ituser': 'IT 管理员'}[username], 'password': editor_password, 'role': role, 'active': True, 'grants': grants}, 'POST')
            alice, bob, reader, ituser = Client(), Client(), Client(), Client()
            for client, name in [(alice, 'alice'), (bob, 'bob'), (reader, 'reader'), (ituser, 'ituser')]:
                client.login(name, editor_password)
            admin.request('/it/users', {'username': 'alice', 'name': 'should not overwrite', 'password': editor_password, 'role': 'reader', 'active': True, 'grants': []}, 'POST', expected=409)
            assert alice.session()['user']['role'] == 'editor'
            reader.request('/it/users', expected=403)
            alice.request('/it/users', expected=403)
            seed = {'type': 'news', 'title': '权限测试', 'body': '<p>正文</p>'}
            ituser.request('/manage/content/' + depts[0], {'data': seed}, 'POST', expected=403)
            alice.request('/manage/content/' + depts[1], {'data': seed}, 'POST', expected=403)

            site = admin.request('/manage/documents/site')
            site_value = json.loads(site['draft'])
            # Legacy configuration has no theme key; it keeps the custom accent.
            site_value.pop('theme', None)
            site = admin.request('/manage/documents/site', {'version': site['version'], 'data': site_value}, 'PUT')
            assert json.loads(site['draft'])['theme'] == 'custom'
            site_value['theme'] = 'unknown-theme'
            admin.request('/manage/documents/site', {'version': site['version'], 'data': site_value}, 'PUT', expected=400)
            site_value['theme'] = 'summer'
            reader.request('/manage/documents/site', {'version': site['version'], 'data': site_value}, 'PUT', expected=403)
            site = admin.request('/manage/documents/site', {'version': site['version'], 'data': site_value}, 'PUT')
            assert reader.request('/portal/site')['theme'] == 'custom', 'Theme drafts must stay private'
            site = admin.request('/manage/documents/site/publish', {'version': site['version']}, 'POST')
            assert reader.request('/portal/site')['theme'] == 'summer'
            assert reader.request('/portal/pages/home')['site']['theme'] == 'summer'
            site_value['theme'] = 'custom'
            site = admin.request('/manage/documents/site', {'version': site['version'], 'data': site_value}, 'PUT')
            admin.request('/manage/documents/site/publish', {'version': site['version']}, 'POST')

            page = admin.request('/manage/documents/home')
            value = json.loads(page['draft'])
            value['modules'] = [{'id': secrets.token_hex(8), 'type': kind, 'title': label, 'width': 12 if kind == 'ticker' else 6, 'count': 5} for kind, label in [('news', '企业动态'), ('notice', '通知公告'), ('video', '培训课堂'), ('document', '正式文件'), ('ticker', '今日头条'), ('survey', '员工问卷')]]
            page = admin.request('/manage/documents/home', {'version': page['version'], 'data': value}, 'PUT')
            assert reader.request('/portal/pages/home')['modules'] == [], 'Draft configuration must stay private'
            reader.request('/portal/pages/home?preview=true', expected=403)
            page = admin.request('/manage/documents/home/publish', {'version': page['version']}, 'POST')
            assert len(reader.request('/portal/pages/home')['modules']) == 6

            news = alice.request('/manage/content/' + depts[0], {'data': {**seed, 'title': '让信息有序流动，让协作自然发生', 'summary': '这是隔离测试数据库中的新闻。', 'body': '<p>欢迎来到企业内容门户。</p><script>alert(1)</script><a href="javascript:alert(2)">危险链接</a>'}}, 'POST')
            assert '<script' not in json.loads(news['draft'])['body'] and 'javascript:' not in json.loads(news['draft'])['body']
            nid = news['id']
            bob.request('/manage/documents/' + nid, expected=403)
            reader.request('/portal/content/' + nid, expected=404)
            news = alice.request(f'/manage/documents/{nid}/publish', {'version': news['version']}, 'POST')
            old_title = json.loads(news['published'])['title']
            changed = json.loads(news['draft']); changed['title'] = '未发布的新标题'
            previous = news['version']
            news = alice.request('/manage/documents/' + nid, {'version': previous, 'data': changed}, 'PUT')
            alice.request('/manage/documents/' + nid, {'version': previous, 'data': changed}, 'PUT', expected=409)
            assert reader.request('/portal/content/' + nid)['item']['data']['title'] == old_title
            portal = reader.request('/portal/pages/home')
            assert any(m['items'] for m in portal['modules'] if m['config']['type'] == 'ticker'), 'Ticker must reuse a published news record'
            news = alice.request(f'/manage/documents/{nid}/publish', {'version': news['version']}, 'POST')

            boundary = 'intranet-' + secrets.token_hex(8)
            payload = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="official.pdf"\r\nContent-Type: application/pdf\r\n\r\n'.encode() + b'%PDF-1.4\n% test document\n' + f'\r\n--{boundary}--\r\n'.encode())
            asset = alice.request('/manage/assets/' + depts[0], method='POST', raw=payload, content_type='multipart/form-data; boundary=' + boundary)
            reader.request('/assets/' + asset['id'], expected=404)
            bob.request('/manage/assets/' + depts[0], expected=403)
            document = alice.request('/manage/content/' + depts[0], {'data': {'type': 'document', 'title': '关于年度工作安排的通知', 'issuer': '企业管理委员会', 'documentNumber': '公司〔2026〕1号'}}, 'POST')
            document_data = json.loads(document['draft']); document_data['assetIds'] = [asset['id']]
            document = alice.request('/manage/documents/' + document['id'], {'version': document['version'], 'data': document_data}, 'PUT')
            document = alice.request('/manage/documents/' + document['id'] + '/publish', {'version': document['version']}, 'POST')
            assert '%PDF' in reader.request('/assets/' + asset['id'])
            alice.request('/manage/assets/' + asset['id'], method='DELETE', expected=409)

            questions = [{'id': 'q1', 'title': '你最关注哪类信息？', 'type': 'single', 'required': True, 'options': ['企业新闻', '培训资源']}, {'id': 'q2', 'title': '体验评分', 'type': 'rating', 'required': True, 'options': []}]
            survey = alice.request('/manage/content/' + depts[0], {'data': {'type': 'survey', 'title': '工作门户使用体验调查', 'summary': '你的意见，帮助我们做得更好。', 'questions': questions, 'endsAt': '2030-01-01T00:00:00Z', 'anonymous': True}}, 'POST')
            sid = survey['id']
            survey = alice.request(f'/manage/documents/{sid}/publish', {'version': survey['version']}, 'POST')
            reader.request(f'/surveys/{sid}/answers', {'answers': {}}, 'POST', expected=400)
            reader.request(f'/surveys/{sid}/answers', {'answers': {'q1': '不存在的选项', 'q2': 5}}, 'POST', expected=400)
            reader.request(f'/surveys/{sid}/answers', {'answers': {'q1': '培训资源', 'q2': 5}}, 'POST')
            reader.request(f'/surveys/{sid}/answers', {'answers': {'q1': '企业新闻', 'q2': 3}}, 'POST', expected=409)
            bob.request(f'/manage/surveys/{sid}/results', expected=403)
            reader.request(f'/manage/surveys/{sid}/results', expected=403)
            stats = alice.request(f'/manage/surveys/{sid}/results')
            assert stats['total'] == 1 and stats['anonymous'] and stats['questions'][1]['average'] == 5
            csv = alice.request(f'/manage/surveys/{sid}/export')
            assert 'reader' not in csv and '匿名' in csv
            changed = json.loads(survey['draft']); changed['questions'][0]['title'] = '改写问题'
            alice.request('/manage/documents/' + sid, {'version': survey['version'], 'data': changed}, 'PUT', expected=409)

            template = admin.request('/it/templates', {'name': '测试模板', 'html': '<section>{{items}}</section>', 'itemHtml': '<article><a href="{{url}}">{{title}}</a><p>{{summary}}</p></article>', 'css': 'article{padding:12px}'}, 'POST')
            tid = template['id']
            template = admin.request(f'/manage/documents/{tid}/publish', {'version': template['version']}, 'POST')
            page_data = json.loads(page['draft']); page_data['modules'][0].update(templateId=tid, templateVersion=template['version'])
            page = admin.request('/manage/documents/home', {'version': page['version'], 'data': page_data}, 'PUT')
            page = admin.request('/manage/documents/home/publish', {'version': page['version']}, 'POST')
            assert reader.request('/portal/pages/home')['modules'][0]['template']['name'] == '测试模板'
            tdata = json.loads(template['draft']); tdata['css'] = 'a{background:url(https://example.org/track)}'
            admin.request('/manage/documents/' + tid, {'version': template['version'], 'data': tdata}, 'PUT', expected=400)
            tdata['css'] = 'article{padding:30px}'; tdata['name'] = '未发布模板名称'
            admin.request('/manage/documents/' + tid, {'version': template['version'], 'data': tdata}, 'PUT')
            assert reader.request('/portal/pages/home')['modules'][0]['template']['name'] == '测试模板', 'Published page must pin a published template version'
            old_page_version = page['version']
            page_data['modules'].pop()
            page = admin.request('/manage/documents/home', {'version': page['version'], 'data': page_data}, 'PUT')
            page = admin.request('/manage/documents/home/restore', {'version': page['version'], 'targetVersion': old_page_version}, 'POST')
            assert len(json.loads(page['draft'])['modules']) == 6
            assert len(reader.request('/portal/content')) == 3, 'Restoring configuration must preserve content'

            if '--browser' in sys.argv:
                browser_env = env | {'E2E_BASE_URL': BASE, 'E2E_ADMIN_PASSWORD': admin_password, 'E2E_EDITOR_PASSWORD': editor_password}
                browser_env['E2E_THEME_COOKIES'] = json.dumps({name: [{'name': c.name, 'value': c.value, 'url': BASE, 'httpOnly': True, 'sameSite': 'Strict'} for c in client.cookies] for name, client in [('admin', admin), ('reader', reader)]})
                subprocess.run(['npm', 'run', 'test:e2e'], cwd=ROOT / 'frontend', env=browser_env, check=True)

            alice.request(f'/manage/documents/{nid}/unpublish', {'version': news['version']}, 'POST')
            reader.request('/portal/content/' + nid, expected=404)
            document = alice.request('/manage/documents/' + document['id'] + '/unpublish', {'version': document['version']}, 'POST')
            reader.request('/assets/' + asset['id'], expected=404)
            admin.request('/it/departments/' + depts[0], {'name': '行政管理部', 'description': '', 'active': False, 'sortOrder': 0}, 'PUT')
            assert reader.request('/portal/content') == []
            assert not alice.session()['user']['grants'], 'Disabled departments must revoke management scope immediately'
            print('PASS: authentication/CSRF, role/department isolation, empty bootstrap, configuration snapshots, content publishing/conflicts, protected assets, anonymous surveys, pinned templates and rollback.')
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill(); process.wait()
            sql(f"DROP DATABASE IF EXISTS `{database}`; REVOKE ALL ON `{database}`.* FROM 'intranet'@'%';")
            shutil.rmtree(ROOT / '.data' / database, ignore_errors=True)


if __name__ == '__main__':
    run()
