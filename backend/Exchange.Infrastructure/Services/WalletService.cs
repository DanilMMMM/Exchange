using Exchange.Application.Common;
using Exchange.Application.DTOs.Wallet;
using Exchange.Application.Interfaces;
using Exchange.Domain.Entities;
using Exchange.Domain.Enums;
using Exchange.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Exchange.Infrastructure.Services;

public class WalletService : IWalletService
{
    private readonly AppDbContext _db;
    private readonly IPriceCache _priceCache;

    public WalletService(AppDbContext db, IPriceCache priceCache) { _db = db; _priceCache = priceCache; }

    public async Task<Result<List<WalletDto>>> GetWalletsAsync(Guid userId, CancellationToken ct = default)
    {
        var wallets = await _db.Wallets
            .Include(w => w.Asset)
            .Where(w => w.UserId == userId)
            .OrderBy(w => w.WalletType).ThenBy(w => w.Asset.Symbol)
            .ToListAsync(ct);

        var dtos = wallets.Select(w =>
        {
            decimal usdtValue;
            if (w.Asset.Symbol == "USDT") usdtValue = w.TotalBalance;
            else
            {
                var price = _priceCache.GetPrice(w.Asset.Symbol + "USDT") ?? 0;
                usdtValue = w.TotalBalance * price;
            }
            return new WalletDto(w.Id, w.WalletType.ToString(), w.Asset.Symbol,
                w.Asset.Name, w.AvailableBalance, w.LockedBalance, w.TotalBalance, usdtValue);
        }).ToList();

        return Result<List<WalletDto>>.Success(dtos);
    }

    public async Task<Result<List<CryptoAddressDto>>> GetOrCreateAddressesAsync(Guid userId, string assetSymbol, CancellationToken ct = default)
    {
        var asset = await _db.Assets.FirstOrDefaultAsync(a => a.Symbol == assetSymbol, ct);
        if (asset == null) return Result<List<CryptoAddressDto>>.Failure("Asset not found", 404);

        var addresses = await _db.CryptoAddresses
            .Where(a => a.UserId == userId && a.AssetId == asset.Id)
            .ToListAsync(ct);

        var dtos = addresses.Select(a => new CryptoAddressDto(a.Id, assetSymbol, a.Network, a.Address)).ToList();
        return Result<List<CryptoAddressDto>>.Success(dtos);
    }

    public async Task<Result<TransferDto>> InternalTransferAsync(Guid senderId, InternalTransferRequest req, CancellationToken ct = default)
    {
        if (req.Amount <= 0) return Result<TransferDto>.Failure("Amount must be positive");

        // Find receiver by address
        var receiverAddress = await _db.CryptoAddresses
            .Include(a => a.User)
            .Include(a => a.Asset)
            .FirstOrDefaultAsync(a => a.Address == req.ToAddress, ct);
        if (receiverAddress == null) return Result<TransferDto>.Failure("Address not found", 404);
        if (receiverAddress.UserId == senderId) return Result<TransferDto>.Failure("Cannot transfer to yourself");
        if (receiverAddress.Asset.Symbol != req.AssetSymbol) return Result<TransferDto>.Failure("Address network mismatch");

        var asset = receiverAddress.Asset;
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var senderWallet = await _db.Wallets.FirstOrDefaultAsync(
                w => w.UserId == senderId && w.WalletType == WalletType.Spot && w.AssetId == asset.Id, ct);
            if (senderWallet == null || senderWallet.AvailableBalance < req.Amount)
                return Result<TransferDto>.Failure("Insufficient balance");

            var receiverWallet = await _db.Wallets.FirstOrDefaultAsync(
                w => w.UserId == receiverAddress.UserId && w.WalletType == WalletType.Spot && w.AssetId == asset.Id, ct);
            if (receiverWallet == null)
            {
                receiverWallet = new Wallet { UserId = receiverAddress.UserId, WalletType = WalletType.Spot, AssetId = asset.Id };
                _db.Wallets.Add(receiverWallet);
            }

            senderWallet.AvailableBalance -= req.Amount;
            senderWallet.UpdatedAt = DateTime.UtcNow;
            receiverWallet.AvailableBalance += req.Amount;
            receiverWallet.UpdatedAt = DateTime.UtcNow;

            // Find sender's address for this asset
            var senderAddr = await _db.CryptoAddresses
                .FirstOrDefaultAsync(a => a.UserId == senderId && a.AssetId == asset.Id, ct);

            var transfer = new Transfer
            {
                TransferType = TransferType.Internal,
                SenderUserId = senderId,
                ReceiverUserId = receiverAddress.UserId,
                AssetId = asset.Id,
                Amount = req.Amount,
                FromAddress = senderAddr?.Address,
                ToAddress = req.ToAddress,
                Note = req.Note
            };
            _db.Transfers.Add(transfer);
            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Result<TransferDto>.Success(MapTransfer(transfer, asset.Symbol));
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    public async Task<Result<TransferDto>> BetweenAccountsTransferAsync(Guid userId, BetweenAccountsTransferRequest req, CancellationToken ct = default)
    {
        if (req.FromWalletType == req.ToWalletType) return Result<TransferDto>.Failure("Source and destination accounts must differ");
        if (req.Amount <= 0) return Result<TransferDto>.Failure("Amount must be positive");

        var usdtAsset = await _db.Assets.FirstAsync(a => a.Symbol == "USDT", ct);
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            var fromWallet = await _db.Wallets.FirstOrDefaultAsync(
                w => w.UserId == userId && w.WalletType == req.FromWalletType && w.AssetId == usdtAsset.Id, ct);
            if (fromWallet == null || fromWallet.AvailableBalance < req.Amount)
                return Result<TransferDto>.Failure("Insufficient balance");

            var toWallet = await _db.Wallets.FirstOrDefaultAsync(
                w => w.UserId == userId && w.WalletType == req.ToWalletType && w.AssetId == usdtAsset.Id, ct);
            if (toWallet == null)
            {
                toWallet = new Wallet { UserId = userId, WalletType = req.ToWalletType, AssetId = usdtAsset.Id };
                _db.Wallets.Add(toWallet);
            }

            fromWallet.AvailableBalance -= req.Amount;
            fromWallet.UpdatedAt = DateTime.UtcNow;
            toWallet.AvailableBalance += req.Amount;
            toWallet.UpdatedAt = DateTime.UtcNow;

            var transfer = new Transfer
            {
                TransferType = TransferType.BetweenAccounts,
                SenderUserId = userId,
                ReceiverUserId = userId,
                AssetId = usdtAsset.Id,
                Amount = req.Amount,
                FromWalletType = req.FromWalletType,
                ToWalletType = req.ToWalletType
            };
            _db.Transfers.Add(transfer);
            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return Result<TransferDto>.Success(MapTransfer(transfer, "USDT"));
        }
        catch { await tx.RollbackAsync(ct); throw; }
    }

    public async Task<Result<AddDemoBalanceResponse>> AddDemoBalanceAsync(Guid userId, CancellationToken ct = default)
    {
        const decimal demoAmount = 10000m;
        var usdtAsset = await _db.Assets.FirstAsync(a => a.Symbol == "USDT", ct);
        var wallet = await _db.Wallets.FirstOrDefaultAsync(
            w => w.UserId == userId && w.WalletType == WalletType.Spot && w.AssetId == usdtAsset.Id, ct);
        if (wallet == null) return Result<AddDemoBalanceResponse>.Failure("Wallet not found", 404);
        wallet.AvailableBalance += demoAmount;
        wallet.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Result<AddDemoBalanceResponse>.Success(new AddDemoBalanceResponse(wallet.AvailableBalance));
    }

    public async Task<Result<List<TransferDto>>> GetTransferHistoryAsync(Guid userId, CancellationToken ct = default)
    {
        var transfers = await _db.Transfers
            .Include(t => t.Asset)
            .Where(t => t.SenderUserId == userId || t.ReceiverUserId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);
        return Result<List<TransferDto>>.Success(transfers.Select(t => MapTransfer(t, t.Asset.Symbol)).ToList());
    }

    private static TransferDto MapTransfer(Transfer t, string assetSymbol) => new(
        t.Id, t.TxHash, t.TransferType.ToString(), assetSymbol,
        t.Amount, t.Status.ToString(), t.FromAddress, t.ToAddress, t.CreatedAt);
}
