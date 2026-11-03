using Dapper;
using MySqlConnector;

namespace Intranet;

public sealed class Documents(Database database)
{
    public async Task<Document> Get(string id, MySqlConnection? connection = null, MySqlTransaction? transaction = null, bool locked = false)
    {
        if (connection is null)
        {
            await using var db = await database.Open();
            return await Get(id, db);
        }
        return await connection.QuerySingleOrDefaultAsync<Document>("SELECT * FROM documents WHERE Id=@id" + (locked ? " FOR UPDATE" : ""), new { id }, transaction)
            ?? throw new ApiError(404, "记录不存在");
    }
    public async Task<List<Document>> List(string kind)
    {
        await using var db = await database.Open();
        return (await db.QueryAsync<Document>("SELECT * FROM documents WHERE Kind=@kind ORDER BY UpdatedAt DESC LIMIT 2000", new { kind })).ToList();
    }
    public async Task EnsureDepartment(string? id, MySqlConnection db, MySqlTransaction? tx = null)
    {
        Validation.Check(id is not null && await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM departments WHERE Id=@id AND Active=1", new { id }, tx) == 1, "所属部门不存在或已停用");
    }
    public async Task<Document> Create(string kind, string? department, string draft, Account user, string? id = null)
    {
        id ??= Guid.NewGuid().ToString();
        await using var db = await database.Open();
        await using var tx = await db.BeginTransactionAsync();
        if (department is not null) await EnsureDepartment(department, db, tx);
        await db.ExecuteAsync("INSERT INTO documents VALUES (@id,@kind,@department,@draft,NULL,1,UTC_TIMESTAMP(6))", new { id, kind, department, draft }, tx);
        await db.ExecuteAsync("INSERT INTO revisions VALUES (@id,1,'create',@actor,@draft,UTC_TIMESTAMP(6))", new { id, actor = user.Name, draft }, tx);
        await Database.Audit(db, user.Name, $"{kind}.create", id, tx);
        await tx.CommitAsync();
        return await Get(id);
    }
    public async Task<Document> Save(string id, int version, string data, Account user, string action = "save", int? restoreVersion = null)
    {
        await using var db = await database.Open();
        await using var tx = await db.BeginTransactionAsync();
        var doc = await Get(id, db, tx, true);
        Authorize(doc, user);
        Validation.Check(doc.Version == version, "其他人已修改此记录，请重新加载后合并修改", 409);
        if (doc.DepartmentId is not null) await EnsureDepartment(doc.DepartmentId, db, tx);
        if (restoreVersion is not null)
            data = await db.QuerySingleOrDefaultAsync<string>("SELECT Data FROM revisions WHERE DocumentId=@id AND Version=@version", new { id, version = restoreVersion }, tx) ?? throw new ApiError(404, "历史版本不存在");
        data = await Validate(doc, data, db, tx, action == "publish");
        string? published = action switch { "publish" => data, "unpublish" => null, _ => doc.Published };
        await db.ExecuteAsync("UPDATE documents SET Draft=@data,Published=@published,Version=Version+1,UpdatedAt=UTC_TIMESTAMP(6) WHERE Id=@id", new { data, published, id }, tx);
        await db.ExecuteAsync("INSERT INTO revisions VALUES (@id,@next,@action,@actor,@data,UTC_TIMESTAMP(6))", new { id, next = version + 1, action, actor = user.Name, data }, tx);
        await Database.Audit(db, user.Name, $"{doc.Kind}.{action}", id, tx);
        await tx.CommitAsync();
        return await Get(id);
    }
    public static void Authorize(Document doc, Account user)
    {
        if (doc.Kind == "content") Access.RequireDepartment(user, doc.DepartmentId);
        else Access.RequireIT(user);
    }
    private async Task<string> Validate(Document doc, string value, MySqlConnection db, MySqlTransaction tx, bool publishing)
    {
        switch (doc.Kind)
        {
            case "content":
                var content = Validation.Content(Json.Read<ContentData>(value));
                // Unpublishing cannot erase the schema contract of a survey that already has answers.
                var lastPublished = await db.QuerySingleOrDefaultAsync<string>("SELECT Data FROM revisions WHERE DocumentId=@Id AND Action='publish' ORDER BY Version DESC LIMIT 1", doc, tx);
                if (lastPublished is not null)
                {
                    var old = Json.Read<ContentData>(lastPublished);
                    Validation.Check(old.Type == content.Type, "已发布内容不能改变类型");
                    if (old.Type == "survey" && await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM participations WHERE SurveyId=@Id", doc, tx) > 0)
                        Validation.Check(Json.Write(old.Questions) == Json.Write(content.Questions) && old.Anonymous == content.Anonymous, "问卷已有答卷，不能修改题目结构或匿名方式，请复制新问卷", 409);
                }
                // Always validate references, even for drafts, to avoid persisting cross-department asset IDs.
                var assetIds = content.AssetIds.Concat(new[] { content.CoverId, content.VideoId }.OfType<string>()).Where(x => x.Length > 0).Distinct().ToList();
                foreach (var assetId in assetIds)
                    Validation.Check(await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM assets WHERE Id=@assetId AND DepartmentId=@DepartmentId", new { assetId, doc.DepartmentId }, tx) == 1, "引用的素材不属于本部门或不存在");
                if (!string.IsNullOrEmpty(content.CoverId))
                    Validation.Check(await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM assets WHERE Id=@id AND Mime LIKE 'image/%'", new { id = content.CoverId }, tx) == 1, "封面必须选择图片素材");
                if (!string.IsNullOrEmpty(content.VideoId))
                    Validation.Check(await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM assets WHERE Id=@id AND Mime LIKE 'video/%'", new { id = content.VideoId }, tx) == 1, "视频必须选择视频素材");
                if (publishing && content.Type == "video")
                    Validation.Check(!string.IsNullOrEmpty(content.VideoId) || content.VideoUrl.Length > 0, "请先上传视频或填写视频地址");
                if (publishing && content.Type == "document")
                    Validation.Check(content.AssetIds.Count > 0 && content.Issuer.Length > 0, "正式文件需要上传原件并填写发文单位");
                if (publishing && content.Type == "survey")
                    Validation.Check(content.Questions.Count > 0 && content.EndsAt is not null, "发布问卷需要题目和结束时间");
                return Json.Write(content);
            case "template": return Json.Write(Validation.Template(Json.Read<TemplateData>(value)));
            case "page":
                var page = Validation.Page(Json.Read<PageData>(value));
                foreach (var module in page.Modules)
                {
                    if (module.DepartmentId.Length > 0) await EnsureDepartment(module.DepartmentId, db, tx);
                    if (publishing && module.TemplateId.Length > 0)
                        _ = await Template(module.TemplateId, module.TemplateVersion, db, tx);
                }
                return Json.Write(page);
            case "site":
                var site = Json.Read<SiteData>(value);
                Validation.Text(site.Name, 100, "站点名称", true); Validation.Text(site.Subtitle, 200, "副标题"); Validation.Text(site.Footer, 500, "页脚"); Validation.Color(site.Accent);
                Validation.Check(site.Theme is "custom" or "spring" or "summer" or "autumn" or "winter" or "christmas" or "new-year" or "lantern" or "halloween" or "monochrome", "请选择有效的站点主题");
                return Json.Write(site);
            default: throw new ApiError(400, "不支持的记录类型");
        }
    }
    public async Task<List<Revision>> History(string id, Account user)
    {
        var doc = await Get(id); Authorize(doc, user);
        await using var db = await database.Open();
        return (await db.QueryAsync<Revision>("SELECT Version,Action,Actor,CreatedAt,Data FROM revisions WHERE DocumentId=@id ORDER BY Version DESC LIMIT 50", new { id })).ToList();
    }
    public async Task<TemplateData> Template(string id, int version, MySqlConnection? connection = null, MySqlTransaction? transaction = null)
    {
        if (connection is null) { await using var db = await database.Open(); return await Template(id, version, db); }
        var data = await connection.QuerySingleOrDefaultAsync<string>("SELECT r.Data FROM revisions r JOIN documents d ON d.Id=r.DocumentId WHERE r.DocumentId=@id AND r.Version=@version AND r.Action='publish' AND d.Kind='template'", new { id, version }, transaction);
        return data is null ? throw new ApiError(400, "模板不存在或所选版本未发布") : Json.Read<TemplateData>(data);
    }
    public async Task<List<PortalItem>> Published()
    {
        await using var db = await database.Open();
        var rows = await db.QueryAsync("""
            SELECT d.Id,d.DepartmentId,p.Name AS DepartmentName,d.Published,
              COALESCE((SELECT MAX(r.CreatedAt) FROM revisions r WHERE r.DocumentId=d.Id AND r.Action='publish'),d.UpdatedAt) AS PublishedAt
            FROM documents d JOIN departments p ON p.Id=d.DepartmentId
            WHERE d.Kind='content' AND d.Published IS NOT NULL AND p.Active=1
            ORDER BY PublishedAt DESC LIMIT 2000
            """);
        var now = DateTimeOffset.UtcNow;
        return rows.Select(r => new PortalItem((string)r.Id, (string)r.DepartmentId, (string)r.DepartmentName, DateTime.SpecifyKind((DateTime)r.PublishedAt, DateTimeKind.Utc), Json.Read<ContentData>((string)r.Published)))
            .Where(r => r.Data.Type == "survey" || ((r.Data.StartsAt is null || r.Data.StartsAt <= now) && (r.Data.EndsAt is null || r.Data.EndsAt > now))).ToList();
    }
    public async Task<object> Portal(string pageId, bool preview, Account user)
    {
        if (preview) Access.RequireIT(user);
        var doc = await Get(pageId);
        Validation.Check(doc.Kind == "page", "页面不存在", 404);
        await using var db = await database.Open();
        if (doc.DepartmentId is not null) await EnsureDepartment(doc.DepartmentId, db);
        var raw = preview ? doc.Draft : doc.Published;
        if (raw is null) throw new ApiError(404, "页面尚未发布");
        var page = Json.Read<PageData>(raw);
        var items = await Published();
        var modules = new List<PortalModule>();
        foreach (var module in page.Modules.Where(m => !m.Hidden))
        {
            var query = items.Where(i => (module.Type == "ticker" ? i.Data.Type is "ticker" or "news" or "notice" : i.Data.Type == module.Type)
                && (module.DepartmentId.Length == 0 || i.DepartmentId == module.DepartmentId)
                && (module.Category.Length == 0 || i.Data.Category == module.Category));
            var selected = query.OrderBy(i => { var index = module.SelectedIds.IndexOf(i.Id); return index < 0 ? int.MaxValue : index; })
                .ThenByDescending(i => i.Data.Pinned).ThenByDescending(i => i.UpdatedAt).Take(module.Count).ToList();
            if (selected.Count == 0 && module.EmptyMode == "hide") continue;
            var template = module.TemplateId.Length == 0 ? null : await Template(module.TemplateId, module.TemplateVersion);
            modules.Add(new(module, selected.Select(i => i with { Data = i.Data with { Body = "", Questions = [] } }).ToList(), template));
        }
        var siteDoc = await Get("site");
        return new { page, modules, site = Json.Read<SiteData>((preview ? siteDoc.Draft : siteDoc.Published) ?? siteDoc.Draft), preview };
    }
}
