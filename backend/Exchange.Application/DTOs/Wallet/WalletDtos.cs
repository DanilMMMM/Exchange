using Exchange.Domain.Enums;

namespace Exchange.Application.DTOs.Wallet;

public record WalletDto(
    Guid Id,
    string WalletType,
    string AssetSymbol,
    string AssetName,
    decimal AvailableBalance,
    decimal LockedBalance,
    decimal TotalBalance,
    decimal UsdtValue);

public record CryptoAddressDto(
    Guid Id,
    string AssetSymbol,
    string Network,
    string Address);

public record InternalTransferRequest(
    string ToAddress,
    string AssetSymbol,
    decimal Amount,
    string? Note);

public record BetweenAccountsTransferRequest(
    WalletType FromWalletType,
    WalletType ToWalletType,
    decimal Amount);

public record TransferDto(
    Guid Id,
    string TxHash,
    string TransferType,
    string AssetSymbol,
    decimal Amount,
    string Status,
    string? FromAddress,
    string? ToAddress,
    DateTime CreatedAt);

public record AddDemoBalanceResponse(decimal NewBalance);
