using System.Text.RegularExpressions;
using Ganss.Xss;

namespace Intranet;

public static partial class Validation
{
    public static readonly HashSet<string> Types = ["news", "notice", "video", "document", "ticker", "survey"];
    public static void Check(bool condition, string message, int status = 400) { if (!condition) throw new ApiError(status, message); }
    public static string Text(string? value, int max, string label, bool required = false)
    {
        value = value?.Trim() ?? "";
        Check((!required || value.Length > 0) && value.Length <= max, $"{label}长度须为{(required ? 1 : 0)}～{max}字");
        return value;
    }
    public static string Url(string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "";
        Check(Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https", "链接仅支持完整的 HTTP/HTTPS 地址");
        return value;
    }
    public static string Html(string html)
    {
        Check(html.Length <= 200_000, "正文过长");
        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedTags.Clear();
        sanitizer.AllowedTags.UnionWith(["p", "br", "strong", "em", "s", "u", "h2", "h3", "h4", "ul", "ol", "li", "blockquote", "a", "code", "pre", "span", "div", "section", "article", "header", "footer", "h1", "h5", "h6", "time", "small"]);
        sanitizer.AllowedAttributes.Clear();
        sanitizer.AllowedAttributes.UnionWith(["href", "class", "title"]);
        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.UnionWith(["https", "http"]);
        return sanitizer.Sanitize(html);
    }
    public static ContentData Content(ContentData data)
    {
        Check(Types.Contains(data.Type), "不支持的内容类型");
        Check(data.StartsAt is null || data.EndsAt is null || data.EndsAt > data.StartsAt, "结束时间必须晚于开始时间");
        Check(data.AssetIds.Count <= 20, "最多关联 20 个附件");
        if (data.Type == "survey")
        {
            Check(data.Questions.Count <= 50, "最多 50 道题");
            Check(data.Questions.Select(q => q.Id).Distinct().Count() == data.Questions.Count, "题目标识不能重复");
            foreach (var q in data.Questions)
            {
                Text(q.Id, 80, "题目标识", true); Text(q.Title, 300, "题目", true);
                Check(new[] { "single", "multiple", "text", "textarea", "number", "rating" }.Contains(q.Type), "不支持的题型");
                Check(q.Min is null || q.Max is null || q.Max >= q.Min, "题目最大值不能小于最小值");
                if (q.Type is "single" or "multiple")
                    Check(q.Options.Count is >= 2 and <= 30 && q.Options.All(o => !string.IsNullOrWhiteSpace(o) && o.Length <= 200) && q.Options.Distinct().Count() == q.Options.Count, "选择题需要 2～30 个非空且不同的选项");
            }
        }
        return data with { Title = Text(data.Title, 200, "标题", true), Summary = Text(data.Summary, 1000, "摘要"), Category = Text(data.Category, 80, "分类"), Author = Text(data.Author, 100, "作者"), Body = Html(data.Body), VideoUrl = Url(data.VideoUrl), Link = Url(data.Link), DocumentNumber = Text(data.DocumentNumber, 100, "文号"), Issuer = Text(data.Issuer, 200, "发文单位"), ChangeNote = Text(data.ChangeNote, 1000, "版本说明"), EffectiveState = new[] { "pending", "effective", "expired", "revoked" }.Contains(data.EffectiveState) ? data.EffectiveState : "effective" };
    }
    public static TemplateData Template(TemplateData data)
    {
        Text(data.Name, 100, "模板名称", true);
        Check(data.Html.Contains("{{items}}"), "外层 HTML 必须包含 {{items}} 占位符");
        Check(data.ItemHtml.Contains("{{title}}"), "单项 HTML 必须包含 {{title}} 占位符");
        Check(data.Css.Length <= 10000 && !ForbiddenCss().IsMatch(data.Css), "CSS 不能包含外部资源、导入或脚本表达式");
        Check(data.Html.Length + data.ItemHtml.Length <= 30000, "模板过长");
        return data with { Html = Html(data.Html), ItemHtml = Html(data.ItemHtml) };
    }
    public static PageData Page(PageData data)
    {
        Text(data.Name, 100, "页面名称", true); Text(data.Description, 1000, "页面介绍");
        Check(data.Layout is "editorial" or "compact", "请选择有效布局"); Color(data.Accent);
        Check(data.Modules.Count <= 30 && data.Modules.Select(m => m.Id).Distinct().Count() == data.Modules.Count, "模块最多 30 个且标识不能重复");
        foreach (var m in data.Modules)
        {
            Check(Types.Contains(m.Type), "模块类型不正确"); Text(m.Title, 100, "模块标题", true);
            Check(m.Width is 4 or 6 or 8 or 12 && m.Count is >= 1 and <= 20, "模块宽度或数量不正确");
            Check(new[] { "list", "cards", "featured" }.Contains(m.Variant), "模块样式不正确");
            Check(m.SelectedIds.Count <= 30, "推荐内容不能超过 30 条");
            Color(m.Accent); Color(m.Background);
        }
        return data;
    }
    public static void Color(string value) => Check(Regex.IsMatch(value, "^#[0-9a-fA-F]{6}$"), "颜色格式不正确");
    [GeneratedRegex(@"url\s*\(|@(?!media\b|container\b|supports\b|keyframes\b)|:host|expression|javascript|[<>\\]", RegexOptions.IgnoreCase)] private static partial Regex ForbiddenCss();
}
