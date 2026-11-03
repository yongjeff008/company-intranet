using Dapper;
using System.Security.Claims;

namespace Intranet;

public sealed class Access(Database database)
{
    public static bool IsIT(Account user) => user.Role is "admin" or "it";
    public static void RequireIT(Account user) { if (!IsIT(user)) throw new ApiError(403, "需要 IT 配置权限"); }
    public static bool CanManage(Account user, string? department) => user.Role == "admin" || (user.Role == "editor" && user.Grants.Any(g => g.DepartmentId == department));
    public static void RequireDepartment(Account user, string? department) { if (!CanManage(user, department)) throw new ApiError(403, "没有该部门的内容维护权限"); }
    public static void RequireResults(Account user, string? department)
    {
        if (user.Role != "admin" && !(user.Role == "editor" && user.Grants.Any(g => g.DepartmentId == department && g.CanViewResults)))
            throw new ApiError(403, "没有此问卷的结果查看权限");
    }
    public async Task<Account?> Current(HttpContext context)
    {
        var id = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (id is null) return null;
        await using var db = await database.Open();
        var user = await db.QuerySingleOrDefaultAsync<StoredUser>("SELECT * FROM users WHERE Id=@id AND Active=1", new { id });
        if (user is null || user.Stamp != context.User.FindFirstValue("stamp")) return null;
        var grants = (await db.QueryAsync<Grant>("SELECT g.DepartmentId,g.CanViewResults FROM grants g JOIN departments d ON d.Id=g.DepartmentId WHERE g.UserId=@id AND d.Active=1", new { id })).ToList();
        return new(user.Id, user.Username, user.Name, user.Role, user.Active, grants);
    }
    public async Task<Account> Require(HttpContext context) => await Current(context) ?? throw new ApiError(401, "请先登录");
}
