using Dapper;
using Microsoft.AspNetCore.Identity;

namespace Intranet;

public static class Accounts
{
    public static async Task<object> Save(string? id, UserInput input, Account actor, Database database)
    {
        Access.RequireIT(actor);
        Validation.Check(new[] { "admin", "it", "editor", "reader" }.Contains(input.Role), "角色不正确");
        var username = Validation.Text(input.Username, 80, "用户名", true);
        Validation.Check(System.Text.RegularExpressions.Regex.IsMatch(username, "^[a-zA-Z0-9_.-]+$"), "用户名只支持字母、数字、下划线、点和横线");
        var name = Validation.Text(input.Name, 100, "姓名", true);
        await using var db = await database.Open(); await using var tx = await db.BeginTransactionAsync();
        var existing = id is null ? null : await db.QuerySingleOrDefaultAsync<StoredUser>("SELECT * FROM users WHERE Id=@id FOR UPDATE", new { id }, tx) ?? throw new ApiError(404, "用户不存在");
        if (actor.Role != "admin") Validation.Check(input.Role is "editor" or "reader" && (existing is null || existing.Role is "editor" or "reader"), "仅超级管理员可管理 IT 和超级管理员账号", 403);
        if (id == actor.Id) Validation.Check(input.Active && input.Role == actor.Role, "不能停用自己或修改自己的角色");
        if (existing is null || !string.IsNullOrEmpty(input.Password)) Validation.Check(input.Password is { Length: >= 12 and <= 128 }, "密码长度须为 12～128 位");
        var user = existing ?? new StoredUser { Id = Guid.NewGuid().ToString() };
        user.Username = username; user.Name = name; user.Role = input.Role; user.Active = input.Active; user.Stamp = Guid.NewGuid().ToString();
        if (!string.IsNullOrEmpty(input.Password)) user.PasswordHash = new PasswordHasher<StoredUser>().HashPassword(user, input.Password);
        if (existing is null)
            await db.ExecuteAsync("INSERT INTO users VALUES (@Id,@Username,@Name,@Role,@PasswordHash,@Active,@Stamp)", user, tx);
        else
            await db.ExecuteAsync("UPDATE users SET Username=@Username,Name=@Name,Role=@Role,PasswordHash=@PasswordHash,Active=@Active,Stamp=@Stamp WHERE Id=@Id", user, tx);
        await db.ExecuteAsync("DELETE FROM grants WHERE UserId=@Id", user, tx);
        Validation.Check(input.Grants.Select(g => g.DepartmentId).Distinct().Count() == input.Grants.Count, "部门授权不能重复");
        foreach (var grant in input.Grants)
        {
            Validation.Check(await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM departments WHERE Id=@DepartmentId AND Active=1", grant, tx) == 1, "授权部门不存在或已停用");
            await db.ExecuteAsync("INSERT INTO grants VALUES (@userId,@DepartmentId,@CanViewResults)", new { userId = user.Id, grant.DepartmentId, grant.CanViewResults }, tx);
        }
        await Database.Audit(db, actor.Name, "user.save", user.Id, tx); await tx.CommitAsync();
        return new { user.Id };
    }
}
