using System.Security.Claims;
using System.Text.Json;
using System.Threading.RateLimiting;
using Dapper;
using Intranet;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
var dataDirectory = Path.GetFullPath(builder.Configuration["CMS_DATA_PATH"] ?? Path.Combine(builder.Environment.ContentRootPath, "../../.data"));
Directory.CreateDirectory(dataDirectory);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 256 * 1024 * 1024);
builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(dataDirectory, "keys"))).SetApplicationName("company-intranet");
builder.Services.AddSingleton<Database>();
builder.Services.AddScoped<Access>(); builder.Services.AddScoped<Documents>(); builder.Services.AddScoped<Surveys>();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "intranet.session"; options.Cookie.HttpOnly = true; options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
    options.ExpireTimeSpan = TimeSpan.FromHours(8); options.SlidingExpiration = true;
    options.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options => { options.HeaderName = "X-CSRF-TOKEN"; options.Cookie.Name = "intranet.csrf"; options.Cookie.SameSite = SameSiteMode.Strict; });
builder.Services.AddRateLimiter(options => options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 })));
var app = builder.Build();
await app.Services.GetRequiredService<Database>().Initialize();
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.XContentTypeOptions = "nosniff";
    ctx.Response.Headers["Referrer-Policy"] = "same-origin";
    ctx.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' https: http: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    try { await next(); }
    catch (Exception error) when (!ctx.Response.HasStarted)
    {
        var (status, message) = error switch
        {
            ApiError api => (api.Status, api.Message),
            AntiforgeryValidationException => (400, "页面验证已过期，请刷新后重试"),
            JsonException => (400, "请求内容格式不正确"),
            BadHttpRequestException => (400, "请求内容无效或文件过大"),
            MySqlConnector.MySqlException mysql when mysql.Number == 1062 => (409, "记录已存在，请检查用户名或重复操作"),
            _ => (500, "服务暂时不可用，请稍后重试")
        };
        if (status == 500) app.Logger.LogError(error, "Request failed: {Path}", ctx.Request.Path);
        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsJsonAsync(new { message });
    }
});
app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/api"))
    {
        ctx.Response.Headers.CacheControl = "no-store";
        if (ctx.Request.Method is not ("GET" or "HEAD" or "OPTIONS"))
            await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx);
        if (ctx.Request.Path != "/api/auth/session" && ctx.Request.Path != "/api/auth/login" && ctx.Request.Path != "/api/health")
            ctx.Items["account"] = await ctx.RequestServices.GetRequiredService<Access>().Require(ctx);
    }
    await next();
});
app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));
app.MapGet("/api/auth/session", async (HttpContext ctx, IAntiforgery csrf, Access access) => new { user = await access.Current(ctx), csrfToken = csrf.GetAndStoreTokens(ctx).RequestToken });
app.MapPost("/api/auth/login", async (LoginInput input, HttpContext ctx, Database database) =>
{
    await using var db = await database.Open();
    var user = await db.QuerySingleOrDefaultAsync<StoredUser>("SELECT * FROM users WHERE Username=@Username", new { Username = input.Username?.Trim() });
    if (user is null || !user.Active || string.IsNullOrEmpty(input.Password) || new PasswordHasher<StoredUser>().VerifyHashedPassword(user, user.PasswordHash, input.Password) == PasswordVerificationResult.Failed)
        throw new ApiError(401, "用户名或密码不正确");
    var claims = new[] { new Claim(ClaimTypes.NameIdentifier, user.Id), new Claim("stamp", user.Stamp) };
    await ctx.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
    await Database.Audit(db, user.Name, "auth.login", user.Id);
    return Results.Ok();
}).RequireRateLimiting("login");
app.MapPost("/api/auth/logout", async (HttpContext ctx) => { await ctx.SignOutAsync(); return Results.Ok(); });

app.MapGet("/api/departments", async (HttpContext ctx, Database database) =>
{
    var user = ctx.Account();
    await using var db = await database.Open();
    var departments = await db.QueryAsync<Department>("SELECT * FROM departments ORDER BY SortOrder,Name");
    return Access.IsIT(user) ? departments : departments.Where(d => d.Active);
});
app.MapPost("/api/it/departments", async (DepartmentInput input, HttpContext ctx, Database database) =>
{
    var user = ctx.Account(); Access.RequireIT(user);
    var id = Guid.NewGuid().ToString();
    await using var db = await database.Open(); await using var tx = await db.BeginTransactionAsync();
    await db.ExecuteAsync("INSERT INTO departments VALUES (@id,@name,@description,@Active,@SortOrder)", new { id, name = Validation.Text(input.Name, 100, "部门名称", true), description = Validation.Text(input.Description, 1000, "部门介绍"), input.Active, input.SortOrder }, tx);
    var data = Json.Write(new PageData(input.Name, input.Description, "editorial", "#226957", []));
    await db.ExecuteAsync("INSERT INTO documents VALUES (@id,'page',@id,@data,NULL,1,UTC_TIMESTAMP(6))", new { id, data }, tx);
    await db.ExecuteAsync("INSERT INTO revisions VALUES (@id,1,'create',@actor,@data,UTC_TIMESTAMP(6))", new { id, actor = user.Name, data }, tx);
    await Database.Audit(db, user.Name, "department.create", id, tx); await tx.CommitAsync();
    return Results.Ok(new { id });
});
app.MapPut("/api/it/departments/{id}", async (string id, DepartmentInput input, HttpContext ctx, Database database) =>
{
    Access.RequireIT(ctx.Account()); await using var db = await database.Open();
    Validation.Check(await db.ExecuteAsync("UPDATE departments SET Name=@name,Description=@description,Active=@Active,SortOrder=@SortOrder WHERE Id=@id", new { id, name = Validation.Text(input.Name, 100, "部门名称", true), description = Validation.Text(input.Description, 1000, "部门介绍"), input.Active, input.SortOrder }) == 1, "部门不存在", 404);
    await Database.Audit(db, ctx.Account().Name, "department.update", id); return Results.Ok();
});
app.MapGet("/api/it/users", async (HttpContext ctx, Database database) =>
{
    Access.RequireIT(ctx.Account()); await using var db = await database.Open();
    var users = await db.QueryAsync<StoredUser>("SELECT * FROM users ORDER BY Username");
    var grants = (await db.QueryAsync("SELECT * FROM grants")).ToList();
    return users.Select(u => new Account(u.Id, u.Username, u.Name, u.Role, u.Active, grants.Where(g => (string)g.UserId == u.Id).Select(g => new Grant((string)g.DepartmentId, (bool)g.CanViewResults)).ToList()));
});
app.MapPost("/api/it/users", async (UserInput input, HttpContext ctx, Database database) => await Accounts.Save(null, input, ctx.Account(), database));
app.MapPut("/api/it/users/{id}", async (string id, UserInput input, HttpContext ctx, Database database) => await Accounts.Save(id, input, ctx.Account(), database));
app.MapGet("/api/it/audit", async (HttpContext ctx, Database database) => { Access.RequireIT(ctx.Account()); await using var db = await database.Open(); return await db.QueryAsync("SELECT Id,Actor,Action,Target,CreatedAt FROM audit ORDER BY Id DESC LIMIT 200"); });
app.MapGet("/api/manage/documents", async (string kind, HttpContext ctx, Documents docs) =>
{
    Validation.Check(new[] { "content", "page", "template", "site" }.Contains(kind), "类型不正确");
    var user = ctx.Account(); if (kind != "content") Access.RequireIT(user);
    return (await docs.List(kind)).Where(d => kind != "content" || Access.CanManage(user, d.DepartmentId));
});
app.MapGet("/api/manage/documents/{id}", async (string id, HttpContext ctx, Documents docs) => { var doc = await docs.Get(id); Documents.Authorize(doc, ctx.Account()); return doc; });
app.MapPost("/api/manage/content/{departmentId}", async (string departmentId, SaveDocument<ContentData> input, HttpContext ctx, Documents docs) =>
{
    var user = ctx.Account(); Access.RequireDepartment(user, departmentId);
    // Creation has no asset references; subsequent save performs full reference validation.
    var data = Validation.Content(input.Data);
    Validation.Check(data.AssetIds.Count == 0 && data.VideoId is null && data.CoverId is null, "请先保存草稿，再关联素材");
    return await docs.Create("content", departmentId, Json.Write(data), user);
});
app.MapPost("/api/it/templates", async (TemplateData input, HttpContext ctx, Documents docs) => { Access.RequireIT(ctx.Account()); return await docs.Create("template", null, Json.Write(Validation.Template(input)), ctx.Account()); });
app.MapPut("/api/manage/documents/{id}", async (string id, SaveDocument<JsonElement> input, HttpContext ctx, Documents docs) => await docs.Save(id, input.Version, input.Data.GetRawText(), ctx.Account()));
app.MapPost("/api/manage/documents/{id}/publish", async (string id, VersionInput input, HttpContext ctx, Documents docs) => { var doc = await docs.Get(id); return await docs.Save(id, input.Version, doc.Draft, ctx.Account(), "publish"); });
app.MapPost("/api/manage/documents/{id}/unpublish", async (string id, VersionInput input, HttpContext ctx, Documents docs) => { var doc = await docs.Get(id); Validation.Check(doc.Id is not ("home" or "site"), "全站首页和站点设置不能下线"); return await docs.Save(id, input.Version, doc.Draft, ctx.Account(), "unpublish"); });
app.MapGet("/api/manage/documents/{id}/history", async (string id, HttpContext ctx, Documents docs) => await docs.History(id, ctx.Account()));
app.MapPost("/api/manage/documents/{id}/restore", async (string id, RestoreInput input, HttpContext ctx, Documents docs) => await docs.Save(id, input.Version, "{}", ctx.Account(), "restore", input.TargetVersion));
app.MapGet("/api/portal/pages/{id}", async (string id, bool? preview, HttpContext ctx, Documents docs) => await docs.Portal(id, preview ?? false, ctx.Account()));
app.MapGet("/api/portal/site", async (Documents docs) => Json.Read<SiteData>((await docs.Get("site")).Published!));
app.MapGet("/api/portal/content", async (string? departmentId, string? type, string? q, Documents docs) =>
    (await docs.Published()).Where(i => (string.IsNullOrEmpty(departmentId) || i.DepartmentId == departmentId) && (string.IsNullOrEmpty(type) || i.Data.Type == type) && (string.IsNullOrEmpty(q) || i.Data.Title.Contains(q, StringComparison.OrdinalIgnoreCase) || i.Data.Summary.Contains(q, StringComparison.OrdinalIgnoreCase) || i.Data.DocumentNumber.Contains(q, StringComparison.OrdinalIgnoreCase)))
    .Select(i => i with { Data = i.Data with { Body = "", Questions = [] } }));
app.MapGet("/api/portal/content/{id}", async (string id, HttpContext ctx, Documents docs, Database database) =>
{
    var item = (await docs.Published()).FirstOrDefault(i => i.Id == id) ?? throw new ApiError(404, "内容不存在或已下线");
    await using var db = await database.Open();
    var submitted = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM participations WHERE SurveyId=@id AND UserId=@userId", new { id, userId = ctx.Account().Id }) > 0;
    return new { item, submitted };
});
app.MapPost("/api/surveys/{id}/answers", async (string id, AnswerInput input, HttpContext ctx, Surveys surveys) => { await surveys.Submit(id, input, ctx.Account()); return Results.Ok(); });
app.MapGet("/api/manage/surveys/{id}/results", async (string id, HttpContext ctx, Surveys surveys) => await surveys.Results(id, ctx.Account()));
app.MapGet("/api/manage/surveys/{id}/export", async (string id, HttpContext ctx, Surveys surveys) => Results.File(System.Text.Encoding.UTF8.GetBytes(await surveys.Csv(id, ctx.Account())), "text/csv; charset=utf-8", "问卷答卷.csv"));
Assets.Map(app, dataDirectory);
app.MapFallback("/api/{**path}", () => Results.NotFound(new { message = "接口不存在" }));
app.UseDefaultFiles(); app.UseStaticFiles();
app.MapFallbackToFile("index.html");
app.Run();

public static class ContextExtensions
{
    public static Account Account(this HttpContext context) => context.Items["account"] as Account ?? throw new ApiError(401, "请先登录");
}
