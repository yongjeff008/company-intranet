using Dapper;
using System.Text.Json;
using System.Globalization;

namespace Intranet;

public sealed class Surveys(Database database, Documents documents)
{
    public async Task Submit(string id, AnswerInput input, Account user)
    {
        await using var db = await database.Open();
        await using var tx = await db.BeginTransactionAsync();
        var doc = await documents.Get(id, db, tx, true);
        await documents.EnsureDepartment(doc.DepartmentId, db, tx);
        Validation.Check(doc.Kind == "content" && doc.Published is not null, "问卷不存在", 404);
        var survey = Json.Read<ContentData>(doc.Published!);
        var now = DateTimeOffset.UtcNow;
        Validation.Check(survey.Type == "survey" && !survey.Closed && (survey.StartsAt is null || survey.StartsAt <= now) && survey.EndsAt > now, "问卷未开始或已经结束");
        Validation.Check(!input.Answers.Keys.Except(survey.Questions.Select(q => q.Id)).Any(), "答案包含未知题目");
        foreach (var q in survey.Questions)
        {
            var exists = input.Answers.TryGetValue(q.Id, out var value);
            var empty = !exists || value.ValueKind == JsonValueKind.Null || (value.ValueKind == JsonValueKind.String && string.IsNullOrWhiteSpace(value.GetString())) || (value.ValueKind == JsonValueKind.Array && value.GetArrayLength() == 0);
            Validation.Check(!q.Required || !empty, $"请填写：{q.Title}");
            if (empty) continue;
            switch (q.Type)
            {
                case "single": Validation.Check(value.ValueKind == JsonValueKind.String && q.Options.Contains(value.GetString()!), $"{q.Title}的选项无效"); break;
                case "multiple":
                    Validation.Check(value.ValueKind == JsonValueKind.Array, $"{q.Title}须为多选答案");
                    var options = value.EnumerateArray().ToList();
                    Validation.Check(options.Count <= q.Options.Count && options.All(o => o.ValueKind == JsonValueKind.String && q.Options.Contains(o.GetString()!)) && options.Select(o => o.GetString()).Distinct().Count() == options.Count, $"{q.Title}的选项无效"); break;
                case "number":
                case "rating":
                    Validation.Check(value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out _), $"{q.Title}须填写数字");
                    var number = value.GetDecimal();
                    Validation.Check((q.Min is null || number >= q.Min) && (q.Max is null || number <= q.Max) && (q.Type != "rating" || (number >= 1 && number <= 5 && decimal.Truncate(number) == number)), $"{q.Title}数值超出范围"); break;
                default: Validation.Check(value.ValueKind == JsonValueKind.String && value.GetString()!.Length <= (q.Type == "text" ? 300 : 3000), $"{q.Title}文字格式或长度不正确"); break;
            }
        }
        try
        {
            // No answer ID or exact submission time is stored with an anonymous participation.
            await db.ExecuteAsync("INSERT INTO participations VALUES (@id,@userId)", new { id, userId = user.Id }, tx);
        }
        catch (MySqlConnector.MySqlException e) when (e.Number == 1062) { throw new ApiError(409, "你已提交此问卷，请勿重复提交"); }
        await db.ExecuteAsync("INSERT INTO answers VALUES (@answerId,@id,@respondent,@payload,UTC_DATE())", new { answerId = Guid.NewGuid().ToString(), id, respondent = survey.Anonymous ? null : user.Id, payload = Json.Write(input.Answers) }, tx);
        await tx.CommitAsync();
    }
    public async Task<object> Results(string id, Account user)
    {
        var doc = await documents.Get(id); Access.RequireResults(user, doc.DepartmentId);
        Validation.Check(doc.Kind == "content", "问卷不存在", 404);
        var survey = Json.Read<ContentData>(doc.Published ?? doc.Draft);
        Validation.Check(survey.Type == "survey", "不是问卷");
        await using var db = await database.Open();
        var payloads = (await db.QueryAsync<string>("SELECT Payload FROM answers WHERE SurveyId=@id", new { id })).Select(Json.Read<Dictionary<string, JsonElement>>).ToList();
        var questions = survey.Questions.Select(q =>
        {
            var values = payloads.Where(a => a.ContainsKey(q.Id)).Select(a => a[q.Id]).ToList();
            var options = q.Options.Select(option => new { option, count = values.Count(v => v.ValueKind == JsonValueKind.String ? v.GetString() == option : v.ValueKind == JsonValueKind.Array && v.EnumerateArray().Any(x => x.GetString() == option)) }).ToList();
            var numeric = values.Where(v => v.ValueKind == JsonValueKind.Number).Select(v => v.GetDecimal()).ToList();
            return new { q.Id, q.Title, q.Type, options, average = numeric.Count == 0 ? (decimal?)null : numeric.Average(), count = values.Count, texts = values.Where(v => v.ValueKind == JsonValueKind.String && q.Type is "text" or "textarea").Select(v => v.GetString()).ToList() };
        }).ToList();
        return new { total = payloads.Count, survey.Anonymous, questions };
    }
    public async Task<string> Csv(string id, Account user)
    {
        var doc = await documents.Get(id); Access.RequireResults(user, doc.DepartmentId);
        var survey = Json.Read<ContentData>(doc.Published ?? doc.Draft);
        Validation.Check(survey.Type == "survey", "不是问卷");
        await using var db = await database.Open();
        var rows = await db.QueryAsync("SELECT a.Payload, u.Name AS Respondent FROM answers a LEFT JOIN users u ON u.Id=a.RespondentId WHERE a.SurveyId=@id", new { id });
        static string Cell(string? value)
        {
            value ??= "";
            if (value.TrimStart().StartsWith('=') || value.TrimStart().StartsWith('+') || value.TrimStart().StartsWith('-') || value.TrimStart().StartsWith('@')) value = "'" + value;
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        }
        var lines = new List<string> { string.Join(',', new[] { Cell(survey.Anonymous ? "答卷" : "填写人") }.Concat(survey.Questions.Select(q => Cell(q.Title)))) };
        foreach (var row in rows)
        {
            var values = Json.Read<Dictionary<string, JsonElement>>((string)row.Payload);
            lines.Add(string.Join(',', new[] { Cell(survey.Anonymous ? "匿名" : (string?)row.Respondent) }.Concat(survey.Questions.Select(q => Cell(values.TryGetValue(q.Id, out var v) ? v.ValueKind == JsonValueKind.Array ? string.Join("；", v.EnumerateArray().Select(x => x.GetString())) : v.ToString() : "")))));
        }
        await Database.Audit(db, user.Name, "survey.export", id);
        return "\uFEFF" + string.Join("\r\n", lines);
    }
}
