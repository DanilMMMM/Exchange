using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Exchange.Application.Common;
using Exchange.Application.DTOs.Auth;
using Exchange.Application.Interfaces;
using Exchange.Domain.Entities;
using Exchange.Domain.Enums;
using Exchange.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Exchange.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private const decimal InitialUsdtBalance = 25000m;

    public AuthService(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<Result<AuthResponse>> RegisterAsync(RegisterRequest req, CancellationToken ct = default)
    {
        if (await _db.Users.AnyAsync(u => u.Email == req.Email, ct))
            return Result<AuthResponse>.Failure("Email already registered", 409);
        if (await _db.Users.AnyAsync(u => u.Username == req.Username, ct))
            return Result<AuthResponse>.Failure("Username already taken", 409);

        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var user = new User
            {
                Email = req.Email,
                Username = req.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
                IsEmailVerified = true  // skip email verification for paper trading
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync(ct);

            // Create Spot + Futures wallets with initial USDT
            var usdt = await _db.Assets.FirstAsync(a => a.Symbol == "USDT", ct);
            _db.Wallets.Add(new Wallet { UserId = user.Id, WalletType = WalletType.Spot, AssetId = usdt.Id, AvailableBalance = InitialUsdtBalance });
            _db.Wallets.Add(new Wallet { UserId = user.Id, WalletType = WalletType.Futures, AssetId = usdt.Id, AvailableBalance = 0 });
            await _db.SaveChangesAsync(ct);

            // Generate wallets for all non-USDT assets (spot)
            var assets = await _db.Assets.Where(a => !a.IsBaseCurrency && a.IsActive).ToListAsync(ct);
            foreach (var asset in assets)
            {
                _db.Wallets.Add(new Wallet { UserId = user.Id, WalletType = WalletType.Spot, AssetId = asset.Id, AvailableBalance = 0 });
            }
            await _db.SaveChangesAsync(ct);

            // Generate crypto addresses
            GenerateCryptoAddresses(user.Id, assets, usdt, _db);
            await _db.SaveChangesAsync(ct);

            var tokens = await GenerateTokensAsync(user, ct);
            await tx.CommitAsync(ct);

            return Result<AuthResponse>.Success(BuildAuthResponse(user, tokens.jwt, tokens.refresh, tokens.expiresAt), 201);
        }
        catch
        {
            await tx.RollbackAsync(ct);
            throw;
        }
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest req, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == req.Email || u.Username == req.Email, ct);
        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Result<AuthResponse>.Failure("Invalid credentials", 401);
        if (!user.IsActive)
            return Result<AuthResponse>.Failure("Account disabled", 403);

        user.LastLoginAt = DateTime.UtcNow;
        var tokens = await GenerateTokensAsync(user, ct);
        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Success(BuildAuthResponse(user, tokens.jwt, tokens.refresh, tokens.expiresAt));
    }

    public async Task<Result<AuthResponse>> RefreshTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        var rt = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == refreshToken && !r.IsRevoked, ct);

        if (rt == null || rt.ExpiresAt < DateTime.UtcNow)
            return Result<AuthResponse>.Failure("Invalid or expired refresh token", 401);

        rt.IsRevoked = true;
        var tokens = await GenerateTokensAsync(rt.User, ct);
        rt.ReplacedBy = tokens.refresh;
        await _db.SaveChangesAsync(ct);

        return Result<AuthResponse>.Success(BuildAuthResponse(rt.User, tokens.jwt, tokens.refresh, tokens.expiresAt));
    }

    public async Task<Result> RevokeTokenAsync(string refreshToken, CancellationToken ct = default)
    {
        var rt = await _db.RefreshTokens.FirstOrDefaultAsync(r => r.Token == refreshToken, ct);
        if (rt == null) return Result.Failure("Token not found", 404);
        rt.IsRevoked = true;
        await _db.SaveChangesAsync(ct);
        return Result.Success();
    }

    private async Task<(string jwt, string refresh, DateTime expiresAt)> GenerateTokensAsync(User user, CancellationToken ct)
    {
        var key = _config["Jwt:Secret"] ?? throw new InvalidOperationException("JWT secret missing");
        var expiresAt = DateTime.UtcNow.AddHours(1);
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.Username)
        };
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt,
            Issuer = _config["Jwt:Issuer"],
            Audience = _config["Jwt:Audience"],
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256)
        };
        var handler = new JwtSecurityTokenHandler();
        var jwt = handler.WriteToken(handler.CreateToken(tokenDescriptor));

        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddDays(30)
        });

        return (jwt, refreshToken, expiresAt);
    }

    private static AuthResponse BuildAuthResponse(User user, string jwt, string refresh, DateTime expiresAt)
        => new(jwt, refresh, expiresAt, new UserDto(user.Id, user.Email, user.Username, user.IsEmailVerified, user.CreatedAt));

    private static void GenerateCryptoAddresses(Guid userId, List<Asset> assets, Asset usdt, AppDbContext db)
    {
        string NewEvm() => "0x" + Convert.ToHexString(RandomNumberGenerator.GetBytes(20)).ToLower();
        string NewBtc() => "bc1q" + GenerateBase58Chars(38);
        string NewTrc() => "T" + GenerateBase58Chars(33);
        string NewSol() => GenerateBase58Chars(44);
        string NewTon() => "UQ" + Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');

        var allAssets = new List<Asset>(assets) { usdt };
        foreach (var asset in allAssets)
        {
            if (asset.Symbol == "USDT")
            {
                db.CryptoAddresses.Add(new CryptoAddress { UserId = userId, AssetId = asset.Id, Network = "TRC20", Address = NewTrc() });
                db.CryptoAddresses.Add(new CryptoAddress { UserId = userId, AssetId = asset.Id, Network = "ERC20", Address = NewEvm() });
                db.CryptoAddresses.Add(new CryptoAddress { UserId = userId, AssetId = asset.Id, Network = "SOL", Address = NewSol() });
                continue;
            }

            var (network, address) = asset.Symbol switch
            {
                "BTC" => ("BTC", NewBtc()),
                "ETH" => ("ERC20", NewEvm()),
                "SOL" => ("SOL", NewSol()),
                "BNB" => ("BEP20", NewEvm()),
                "XRP" => ("XRP", "r" + GenerateBase58Chars(33)),
                "TON" => ("TON", NewTon()),
                "DOGE" => ("DOGE", "D" + GenerateBase58Chars(33)),
                "ADA" => ("ADA", "addr1" + GenerateBase58Chars(53)),
                "AVAX" => ("ERC20", NewEvm()),
                "LINK" => ("ERC20", NewEvm()),
                "DOT" => ("DOT", "1" + GenerateBase58Chars(46)),
                "LTC" => ("LTC", "ltc1" + GenerateBase58Chars(38)),
                "TRX" => ("TRC20", NewTrc()),
                "NEAR" => ("NEAR", GenerateBase58Chars(44) + ".near"),
                "SUI" => ("SUI", "0x" + Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLower()),
                "ARB" => ("ARB", NewEvm()),
                "OP" => ("OP", NewEvm()),
                "PEPE" => ("ERC20", NewEvm()),
                "UNI" => ("ERC20", NewEvm()),
                "ATOM" => ("ATOM", "cosmos1" + GenerateBase58Chars(38)),
                "APT" => ("APT", "0x" + Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLower()),
                "SHIB" => ("ERC20", NewEvm()),
                "WIF" => ("SOL", NewSol()),
                "RENDER" => ("ERC20", NewEvm()),
                "NOT" => ("TON", NewTon()),
                _ => ("ERC20", NewEvm())
            };

            db.CryptoAddresses.Add(new CryptoAddress
            {
                UserId = userId,
                AssetId = asset.Id,
                Network = network,
                Address = address
            });
        }
    }

    private static readonly char[] Base58Chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".ToCharArray();
    private static string GenerateBase58Chars(int length)
    {
        var bytes = RandomNumberGenerator.GetBytes(length);
        return new string(bytes.Select(b => Base58Chars[b % Base58Chars.Length]).ToArray());
    }
}
