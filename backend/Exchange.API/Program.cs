using System.Text;
using Exchange.API.Hubs;
using Exchange.API.Middleware;
using Exchange.Application.Interfaces;
using Exchange.Infrastructure.BackgroundServices;
using Exchange.Infrastructure.Data;
using Exchange.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ============================================================
// DATABASE — PostgreSQL via EF Core (NO auto-migrate)
// ============================================================
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ============================================================
// AUTHENTICATION — JWT Bearer
// ============================================================
var jwtKey = builder.Configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var accessToken = ctx.Request.Query["access_token"];
                var path = ctx.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    ctx.Token = accessToken;
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// ============================================================
// SIGNALR
// ============================================================
builder.Services.AddSignalR(opt =>
{
    opt.EnableDetailedErrors = builder.Environment.IsDevelopment();
    opt.MaximumReceiveMessageSize = 512 * 1024;
});

// ============================================================
// HTTP CLIENTS
// ============================================================
builder.Services.AddHttpClient("Bybit", c =>
{
    c.BaseAddress = new Uri("https://api.bybit.com");
    c.DefaultRequestHeaders.Add("User-Agent", "CryptoExchange/1.0");
    c.Timeout = TimeSpan.FromSeconds(10);
});

// ============================================================
// SERVICES
// ============================================================
builder.Services.AddSingleton<PriceCache>();
builder.Services.AddSingleton<IPriceCache>(sp => sp.GetRequiredService<PriceCache>());
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IFuturesService, FuturesService>();
builder.Services.AddScoped<IWalletService, WalletService>();
builder.Services.AddScoped<IMarketDataService, MarketDataService>();
builder.Services.AddSingleton<INotificationService, NotificationService>();

// ============================================================
// BACKGROUND SERVICES
// ============================================================
builder.Services.AddSingleton<BybitWebSocketService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<BybitWebSocketService>());
builder.Services.AddHostedService<MatchingEngineService>();
builder.Services.AddHostedService<LiquidationEngineService>();

// ============================================================
// CORS
// ============================================================
builder.Services.AddCors(opt => opt.AddPolicy("AllowFrontend", p =>
    p.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://localhost:4173")
     .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

// ============================================================
// SWAGGER
// ============================================================
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "CryptoExchange API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization", Type = SecuritySchemeType.Http,
        Scheme = "Bearer", BearerFormat = "JWT", In = ParameterLocation.Header
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

builder.Services.AddControllers();

var app = builder.Build();

app.UseMiddleware<GlobalExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowFrontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<ExchangeHub>("/hubs/exchange");

// NOTE: DO NOT call Database.Migrate() — run init_db.sql manually in pgAdmin.

app.Run();
