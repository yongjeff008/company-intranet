using Dapper;
using MySqlConnector;
using Microsoft.AspNetCore.Identity;

namespace Intranet;

public sealed class Database(IConfiguration configuration)
{
    public async Task<MySqlConnection> Open()
    {
        var options = new MySqlConnectionStringBuilder(configuration.GetConnectionString("Cms")
            ?? throw new InvalidOperationException("缺少 ConnectionStrings__Cms，请运行 ./scripts/setup.sh"))
        { GuidFormat = MySqlGuidFormat.None };
        var connection = new MySqlConnection(options.ConnectionString);
        await connection.OpenAsync();
        return connection;
    }

    public async Task Initialize()
    {
        await using var db = await Open();
        await db.ExecuteAsync("""
            CREATE TABLE IF NOT EXISTS users (
              Id CHAR(36) PRIMARY KEY, Username VARCHAR(80) NOT NULL UNIQUE,
              Name VARCHAR(100) NOT NULL, Role VARCHAR(20) NOT NULL,
              PasswordHash VARCHAR(500) NOT NULL, Active BOOLEAN NOT NULL, Stamp CHAR(36) NOT NULL);
            CREATE TABLE IF NOT EXISTS departments (
              Id CHAR(36) PRIMARY KEY, Name VARCHAR(100) NOT NULL,
              Description VARCHAR(1000) NOT NULL, Active BOOLEAN NOT NULL, SortOrder INT NOT NULL);
            CREATE TABLE IF NOT EXISTS grants (
              UserId CHAR(36) NOT NULL, DepartmentId CHAR(36) NOT NULL, CanViewResults BOOLEAN NOT NULL,
              PRIMARY KEY(UserId, DepartmentId), FOREIGN KEY(UserId) REFERENCES users(Id),
              FOREIGN KEY(DepartmentId) REFERENCES departments(Id));
            CREATE TABLE IF NOT EXISTS documents (
              Id VARCHAR(80) PRIMARY KEY, Kind VARCHAR(20) NOT NULL, DepartmentId CHAR(36) NULL,
              Draft LONGTEXT NOT NULL, Published LONGTEXT NULL, Version INT NOT NULL, UpdatedAt DATETIME(6) NOT NULL,
              INDEX ix_documents_scope(Kind, DepartmentId));
            CREATE TABLE IF NOT EXISTS revisions (
              DocumentId VARCHAR(80) NOT NULL, Version INT NOT NULL, Action VARCHAR(20) NOT NULL,
              Actor VARCHAR(100) NOT NULL, Data LONGTEXT NOT NULL, CreatedAt DATETIME(6) NOT NULL,
              PRIMARY KEY(DocumentId, Version));
            CREATE TABLE IF NOT EXISTS assets (
              Id CHAR(36) PRIMARY KEY, DepartmentId CHAR(36) NOT NULL, Filename VARCHAR(255) NOT NULL,
              StoredName VARCHAR(100) NOT NULL, Mime VARCHAR(100) NOT NULL, Size BIGINT NOT NULL);
            CREATE TABLE IF NOT EXISTS participations (
              SurveyId VARCHAR(80) NOT NULL, UserId CHAR(36) NOT NULL, PRIMARY KEY(SurveyId, UserId));
            CREATE TABLE IF NOT EXISTS answers (
              Id CHAR(36) PRIMARY KEY, SurveyId VARCHAR(80) NOT NULL,
              RespondentId CHAR(36) NULL, Payload LONGTEXT NOT NULL, CreatedOn DATE NOT NULL,
              INDEX ix_answers_survey(SurveyId));
            CREATE TABLE IF NOT EXISTS audit (
              Id BIGINT AUTO_INCREMENT PRIMARY KEY, Actor VARCHAR(100) NOT NULL,
              Action VARCHAR(80) NOT NULL, Target VARCHAR(100) NOT NULL, CreatedAt DATETIME(6) NOT NULL);
            """);
        // A database lock also makes first-run initialization safe with two app instances.
        await db.ExecuteAsync("SELECT GET_LOCK('intranet-bootstrap', 20)");
        try
        {
            if (await db.ExecuteScalarAsync<int>("SELECT COUNT(*) FROM users") == 0)
            {
                var password = configuration["CMS_BOOTSTRAP_PASSWORD"];
                if (password is null || password.Length < 12)
                    throw new InvalidOperationException("首次运行请设置至少 12 位 CMS_BOOTSTRAP_PASSWORD");
                var user = new StoredUser { Id = Guid.NewGuid().ToString(), Username = "admin", Name = "系统管理员", Role = "admin", Active = true, Stamp = Guid.NewGuid().ToString() };
                user.PasswordHash = new PasswordHasher<StoredUser>().HashPassword(user, password);
                await db.ExecuteAsync("INSERT INTO users VALUES (@Id,@Username,@Name,@Role,@PasswordHash,@Active,@Stamp)", user);
            }
            var page = new PageData("企业门户", "让信息有序流动，让协作自然发生。", "editorial", "#226957", []);
            var site = new SiteData("企业内网", "INTRANET · WORKPLACE", "内部信息 · 连接每一位同事", "#226957");
            foreach (var (id, kind, value) in new[] { ("home", "page", Json.Write(page)), ("site", "site", Json.Write(site)) })
                await db.ExecuteAsync("INSERT IGNORE INTO documents VALUES (@id,@kind,NULL,@value,@value,1,UTC_TIMESTAMP(6))", new { id, kind, value });
            await db.ExecuteAsync("INSERT IGNORE INTO revisions SELECT Id,1,'publish','系统初始化',Draft,UpdatedAt FROM documents WHERE Id IN ('home','site') AND Version=1");
        }
        finally { await db.ExecuteAsync("SELECT RELEASE_LOCK('intranet-bootstrap')"); }
    }

    public static Task Audit(MySqlConnection db, string actor, string action, string target, MySqlTransaction? tx = null) =>
        db.ExecuteAsync("INSERT INTO audit (Actor,Action,Target,CreatedAt) VALUES (@actor,@action,@target,UTC_TIMESTAMP(6))", new { actor, action, target }, tx);
}
