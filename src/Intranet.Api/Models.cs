using System.Text.Json;

namespace Intranet;

public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);
    public static string Write<T>(T value) => JsonSerializer.Serialize(value, Options);
    public static T Read<T>(string value) => JsonSerializer.Deserialize<T>(value, Options)!;
}

public sealed record Department(string Id, string Name, string Description, bool Active, int SortOrder);
public sealed record Grant(string DepartmentId, bool CanViewResults);
public sealed record Account(string Id, string Username, string Name, string Role, bool Active, List<Grant> Grants);
public sealed record UserInput(string Username, string Name, string Role, string? Password, bool Active, List<Grant> Grants);
public sealed record LoginInput(string Username, string Password);
public sealed record DepartmentInput(string Name, string Description, bool Active, int SortOrder);
public sealed class StoredUser
{
    public string Id { get; set; } = "";
    public string Username { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public bool Active { get; set; }
    public string Stamp { get; set; } = "";
}
public sealed class Document
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";
    public string? DepartmentId { get; set; }
    public string Draft { get; set; } = "{}";
    public string? Published { get; set; }
    public int Version { get; set; }
    public DateTime UpdatedAt { get; set; }
}
public sealed record SaveDocument<T>(int Version, T Data);
public sealed record VersionInput(int Version);
public sealed record RestoreInput(int Version, int TargetVersion);
public sealed record Revision(int Version, string Action, string Actor, DateTime CreatedAt, string Data);
public sealed record ContentData
{
    public string Type { get; init; } = "news";
    public string Title { get; init; } = "";
    public string Summary { get; init; } = "";
    public string Body { get; init; } = "";
    public string Category { get; init; } = "";
    public string Author { get; init; } = "";
    public bool Pinned { get; init; }
    public string? CoverId { get; init; }
    public List<string> AssetIds { get; init; } = [];
    public string? VideoId { get; init; }
    public string VideoUrl { get; init; } = "";
    public string Link { get; init; } = "";
    public string DocumentNumber { get; init; } = "";
    public string Issuer { get; init; } = "";
    public string IssuedOn { get; init; } = "";
    public string EffectiveState { get; init; } = "effective";
    public string ReplacesId { get; init; } = "";
    public string ChangeNote { get; init; } = "";
    public DateTimeOffset? StartsAt { get; init; }
    public DateTimeOffset? EndsAt { get; init; }
    public List<Question> Questions { get; init; } = [];
    public bool Anonymous { get; init; } = true;
    public bool Closed { get; init; }
}
public sealed record Question(string Id, string Title, string Type, bool Required, List<string> Options, decimal? Min, decimal? Max);
public sealed record AnswerInput(Dictionary<string, JsonElement> Answers);
public sealed record TemplateData(string Name, string Html, string ItemHtml, string Css);
public sealed record ModuleData
{
    public string Id { get; init; } = Guid.NewGuid().ToString();
    public string Type { get; init; } = "news";
    public string Title { get; init; } = "新闻资讯";
    public string Variant { get; init; } = "list";
    public int Width { get; init; } = 6;
    public int Count { get; init; } = 5;
    public bool Hidden { get; init; }
    public string DepartmentId { get; init; } = "";
    public string Category { get; init; } = "";
    public string Accent { get; init; } = "#226957";
    public string Background { get; init; } = "#ffffff";
    public string EmptyMode { get; init; } = "show";
    public string TickerMode { get; init; } = "scroll";
    public List<string> SelectedIds { get; init; } = [];
    public string TemplateId { get; init; } = "";
    public int TemplateVersion { get; init; }
}
public sealed record PageData(string Name, string Description, string Layout, string Accent, List<ModuleData> Modules);
public sealed record SiteData(string Name, string Subtitle, string Footer, string Accent, string Theme = "custom");
public sealed record PortalItem(string Id, string DepartmentId, string DepartmentName, DateTime UpdatedAt, ContentData Data);
public sealed record PortalModule(ModuleData Config, List<PortalItem> Items, TemplateData? Template);
public sealed class Asset
{
    public string Id { get; set; } = "";
    public string DepartmentId { get; set; } = "";
    public string Filename { get; set; } = "";
    public string StoredName { get; set; } = "";
    public string Mime { get; set; } = "";
    public long Size { get; set; }
}
public sealed class ApiError(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}
