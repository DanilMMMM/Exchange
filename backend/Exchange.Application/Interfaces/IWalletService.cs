using Exchange.Application.DTOs.Wallet;
using Exchange.Application.Common;

namespace Exchange.Application.Interfaces;

public interface IWalletService
{
    Task<Result<List<WalletDto>>> GetWalletsAsync(Guid userId, CancellationToken ct = default);
    Task<Result<List<CryptoAddressDto>>> GetOrCreateAddressesAsync(Guid userId, string assetSymbol, CancellationToken ct = default);
    Task<Result<TransferDto>> InternalTransferAsync(Guid senderId, InternalTransferRequest request, CancellationToken ct = default);
    Task<Result<TransferDto>> BetweenAccountsTransferAsync(Guid userId, BetweenAccountsTransferRequest request, CancellationToken ct = default);
    Task<Result<AddDemoBalanceResponse>> AddDemoBalanceAsync(Guid userId, CancellationToken ct = default);
    Task<Result<List<TransferDto>>> GetTransferHistoryAsync(Guid userId, CancellationToken ct = default);
}
