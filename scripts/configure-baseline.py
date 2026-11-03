#!/usr/bin/env python3
"""Apply the reviewed ordinary intranet layout through the same APIs used by IT.

Does not insert any news, files, videos, messages, questionnaires or answers.
Existing nonempty pages and accounts are preserved; initial credentials stay in .data.
"""
import http.cookiejar
import json
import os
from pathlib import Path
import secrets
import shlex
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('CMS_BASE_URL', 'http://127.0.0.1:5088')


class Client:
    def __init__(self):
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.token = ''

    def request(self, path, data=None, method='GET'):
        headers = {'X-CSRF-TOKEN': self.token}
        body = None
        if data is not None:
            headers['Content-Type'] = 'application/json'
            body = json.dumps(data).encode()
        try:
            with self.opener.open(urllib.request.Request(BASE + '/api' + path, data=body, headers=headers, method=method), timeout=20) as response:
                text = response.read()
                return json.loads(text) if text else None
        except urllib.error.HTTPError as error:
            raise RuntimeError(f'{method} {path}: {error.code} {error.read().decode()}') from None

    def login(self, username, password):
        self.token = self.request('/auth/session')['csrfToken']
        self.request('/auth/login', {'username': username, 'password': password}, 'POST')
        session = self.request('/auth/session')
        self.token = session['csrfToken']
        return session['user']


def private_json(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as file:
        json.dump(value, file, ensure_ascii=False, indent=2)


def module(kind, title, width=6, variant='list', department='', color='#226957', background='#ffffff', count=5):
    return dict(id=str(uuid.uuid4()), type=kind, title=title, variant=variant, width=width, count=count,
                hidden=False, departmentId=department, category='', accent=color, background=background,
                emptyMode='show', tickerMode='scroll', selectedIds=[], templateId='', templateVersion=0)


def main():
    password = os.environ.get('CMS_ADMIN_PASSWORD')
    if not password:
        password = next(shlex.split(line.split('=', 1)[1])[0] for line in (ROOT / '.env').read_text().splitlines() if line.startswith('CMS_BOOTSTRAP_PASSWORD='))
    client = Client()
    user = client.login('admin', password)
    if user['role'] != 'admin':
        raise RuntimeError('需要系统管理员授权配置')
    data = ROOT / '.data'
    data.mkdir(exist_ok=True)
    snapshot = {'departments': client.request('/departments'), 'pages': client.request('/manage/documents?kind=page'), 'site': client.request('/manage/documents/site')}
    private_json(data / ('baseline-backup-' + uuid.uuid4().hex[:10] + '.json'), snapshot)
    credentials_path = data / 'baseline-access.json'
    credentials = json.loads(credentials_path.read_text()) if credentials_path.exists() else {}
    existing = {department['name']: department for department in snapshot['departments']}
    specs = [
        ('综合管理部', '行政事务、企业资讯与综合服务，让日常工作有序开展。', 'office_admin', True),
        ('人力资源部', '人才发展、培训学习与员工服务，陪伴每一步成长。', 'hr_admin', True),
        ('财务管理部', '财务通知、制度文件与业务指引，让信息清晰可查。', 'finance_admin', False),
        ('信息技术部', '系统通知、技术培训与信息服务，为高效工作提供支持。', 'it_editor', False),
    ]
    departments = {}
    for index, (name, description, _, _) in enumerate(specs):
        if name not in existing:
            value = client.request('/it/departments', dict(name=name, description=description, active=True, sortOrder=index), 'POST')
            departments[name] = value['id']
        else:
            if not existing[name]['active']:
                raise RuntimeError(f'{name}已存在但被停用，请先确认后再配置')
            departments[name] = existing[name]['id']

    def publish_page(page_id, name, description, layout, modules):
        doc = client.request('/manage/documents/' + page_id)
        if json.loads(doc['draft'])['modules']:
            return  # Do not overwrite an IT-edited page when this script is run again.
        value = dict(name=name, description=description, layout=layout, accent='#226957', modules=modules)
        saved = client.request('/manage/documents/' + page_id, {'version': doc['version'], 'data': value}, 'PUT')
        client.request('/manage/documents/' + page_id + '/publish', {'version': saved['version']}, 'POST')

    publish_page('home', '企业信息门户', '汇聚企业动态、工作通知与部门知识，让每一位同事及时获取所需信息。', 'editorial', [
        module('ticker', '今日要闻', 12, background='#f0f5ed', count=6),
        module('news', '企业新闻', 8, 'featured', count=5),
        module('notice', '通知公告', 4, color='#a57738', background='#fffdf8', count=6),
        module('document', '公司文件', 8, color='#a26351', count=6),
        module('survey', '员工调查', 4, 'cards', color='#7e6b99', count=2),
        module('video', '培训课堂', 12, 'cards', color='#53788e', count=4),
    ])
    page_modules = [
        [('news', '部门动态', 6, 'featured'), ('notice', '行政通知', 6, 'list'), ('document', '行政文件', 12, 'list')],
        [('notice', '人事通知', 6, 'list'), ('video', '培训学习', 6, 'cards'), ('document', '人事文件', 6, 'list'), ('survey', '员工意见调查', 6, 'cards')],
        [('notice', '财务通知', 6, 'list'), ('document', '财务文件', 6, 'list'), ('news', '财务动态', 12, 'list')],
        [('notice', '系统与服务公告', 6, 'list'), ('video', '数字技能培训', 6, 'cards'), ('news', '技术动态', 6, 'list'), ('survey', '信息服务反馈', 6, 'cards')],
    ]
    for (name, description, _, _), items in zip(specs, page_modules):
        publish_page(departments[name], name, description, 'compact', [module(kind, title, width, variant, department=departments[name]) for kind, title, width, variant in items])

    site = client.request('/manage/documents/site')
    if json.loads(site['draft'])['name'] == '企业内网':
        value = dict(name='企业信息门户', subtitle='CONNECTED WORKPLACE · 信息共享 / 高效协同', footer='企业信息门户 · 内部工作空间', accent='#226957')
        site = client.request('/manage/documents/site', {'version': site['version'], 'data': value}, 'PUT')
        client.request('/manage/documents/site/publish', {'version': site['version']}, 'POST')

    users = {account['username']: account for account in client.request('/it/users')}
    accounts = [('it_config', '内网配置管理员', 'it', [])]
    accounts += [(username, name + '管理员', 'editor', [{'departmentId': departments[name], 'canViewResults': results}]) for name, _, username, results in specs]
    accounts += [('employee', '普通员工', 'reader', [])]
    for username, name, role, grants in accounts:
        if username in users:
            if users[username]['role'] != role:
                raise RuntimeError(f'{username}已存在但角色不匹配，未修改该账号')
            continue
        secret = secrets.token_urlsafe(12)
        # Persist before the request so an interrupted response does not lose the initial password.
        credentials[username] = dict(name=name, role=role, password=secret)
        private_json(credentials_path, credentials)
        client.request('/it/users', dict(username=username, name=name, role=role, password=secret, active=True, grants=grants), 'POST')

    portal = client.request('/portal/pages/home')
    content_count = len(client.request('/portal/content'))
    report = {'site': portal['site']['name'], 'departments': departments, 'homeModules': [m['config']['title'] for m in portal['modules']], 'departmentPages': len(departments), 'publishedContent': content_count, 'accountFile': '.data/baseline-access.json'}
    private_json(data / 'baseline-config-report.json', report)
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
