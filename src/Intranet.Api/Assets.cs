using Dapper;

namespace Intranet;

public static class Assets
{
    private static readonly Dictionary<string, string> Mimes = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".webp"] = "image/webp",
        [".pdf"] = "application/pdf",
        [".mp4"] = "video/mp4",
        [".webm"] = "video/webm",
        [".txt"] = "text/plain",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".pptx"] = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    };
    public static void Map(WebApplication app, string directory)
    {
        var assetsDirectory = Path.Combine(directory, "uploads"); Directory.CreateDirectory(assetsDirectory);
        app.MapGet("/api/manage/assets/{departmentId}", async (string departmentId, HttpContext ctx, Database database) =>
        {
            Access.RequireDepartment(ctx.Account(), departmentId); await using var db = await database.Open();
            return await db.QueryAsync<Asset>("SELECT * FROM assets WHERE DepartmentId=@departmentId ORDER BY Filename LIMIT 1000", new { departmentId });
        });
        app.MapPost("/api/manage/assets/{departmentId}", async (string departmentId, HttpContext ctx, Database database, Documents docs) =>
        {
            Access.RequireDepartment(ctx.Account(), departmentId);
            await using var db = await database.Open(); await docs.EnsureDepartment(departmentId, db);
            var form = await ctx.Request.ReadFormAsync(); var file = form.Files.GetFile("file");
            Validation.Check(file is not null && file.Length > 0 && file.Length <= 200 * 1024 * 1024, "文件须为 1 字节～200MB");
            var filename = Path.GetFileName(file!.FileName); var ext = Path.GetExtension(filename).ToLowerInvariant();
            Validation.Check(filename.Length <= 255 && Mimes.ContainsKey(ext), "支持图片、PDF、Office 文档、文本及 MP4/WebM 视频");
            var id = Guid.NewGuid().ToString(); var storedName = id + ext; var path = Path.Combine(assetsDirectory, storedName);
            try
            {
                await using (var output = File.Create(path)) await file.CopyToAsync(output, ctx.RequestAborted);
                var asset = new Asset { Id = id, DepartmentId = departmentId, Filename = filename, StoredName = storedName, Mime = Mimes[ext], Size = file.Length };
                await db.ExecuteAsync("INSERT INTO assets VALUES (@Id,@DepartmentId,@Filename,@StoredName,@Mime,@Size)", asset);
                await Database.Audit(db, ctx.Account().Name, "asset.upload", id); return Results.Ok(asset);
            }
            catch { if (File.Exists(path)) File.Delete(path); throw; }
        });
        app.MapGet("/api/assets/{id}", async (string id, HttpContext ctx, Database database, Documents docs) =>
        {
            await using var db = await database.Open();
            var asset = await db.QuerySingleOrDefaultAsync<Asset>("SELECT * FROM assets WHERE Id=@id", new { id }) ?? throw new ApiError(404, "文件不存在");
            var authorized = Access.CanManage(ctx.Account(), asset.DepartmentId) || (await docs.Published()).Any(i => i.Data.AssetIds.Contains(id) || i.Data.CoverId == id || i.Data.VideoId == id);
            if (!authorized) throw new ApiError(404, "文件不存在或无权访问");
            var path = Path.Combine(assetsDirectory, asset.StoredName); if (!File.Exists(path)) throw new ApiError(404, "文件已丢失，请联系管理员");
            ctx.Response.Headers.ContentDisposition = "inline; filename*=UTF-8''" + Uri.EscapeDataString(asset.Filename);
            return Results.File(path, asset.Mime, enableRangeProcessing: true);
        });
        app.MapDelete("/api/manage/assets/{id}", async (string id, HttpContext ctx, Database database, Documents docs) =>
        {
            await using var db = await database.Open(); var asset = await db.QuerySingleOrDefaultAsync<Asset>("SELECT * FROM assets WHERE Id=@id", new { id }) ?? throw new ApiError(404, "文件不存在");
            Access.RequireDepartment(ctx.Account(), asset.DepartmentId);
            // Drafts and all retained history protect their references as well as the live version.
            var references = await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM revisions WHERE Data LIKE @pattern", new { pattern = "%" + id + "%" });
            Validation.Check(references == 0, "素材仍被内容或历史版本引用，不能删除", 409);
            await db.ExecuteAsync("DELETE FROM assets WHERE Id=@id", new { id }); File.Delete(Path.Combine(assetsDirectory, asset.StoredName));
            await Database.Audit(db, ctx.Account().Name, "asset.delete", id); return Results.Ok();
        });
    }
}
