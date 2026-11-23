using Exchange.Application.DTOs.Wallet;
using Exchange.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Exchange.API.Controllers;

[ApiController]
[Route("api/wallet")]
[Authorize]
public class WalletController : BaseController
{
    private readonly IWalletService _wallet;
    public WalletController(IWalletService wallet) => _wallet = wallet;

    /// <summary>Get all wallets (Spot + Futures) with USDT valuation</summary>
    [HttpGet]
    public async Task<IActionResult> GetWallets(CancellationToken ct)
    {
        var result = await _wallet.GetWalletsAsync(CurrentUserId, ct);
        return Ok(result.Data);
    }

    /// <summary>Get/generate deposit addresses for an asset</summary>
    [HttpGet("addresses/{assetSymbol}")]
    public async Task<IActionResult> GetAddresses(string assetSymbol, CancellationToken ct)
    {
        var result = await _wallet.GetOrCreateAddressesAsync(CurrentUserId, assetSymbol, ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(result.StatusCode, new { error = result.Error });
    }

    /// <summary>Send crypto to another user by their deposit address</summary>
    [HttpPost("transfer/internal")]
    public async Task<IActionResult> InternalTransfer([FromBody] InternalTransferRequest req, CancellationToken ct)
    {
        var result = await _wallet.InternalTransferAsync(CurrentUserId, req, ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(result.StatusCode, new { error = result.Error });
    }

    /// <summary>Move USDT between Spot and Futures accounts</summary>
    [HttpPost("transfer/accounts")]
    public async Task<IActionResult> BetweenAccountsTransfer([FromBody] BetweenAccountsTransferRequest req, CancellationToken ct)
    {
        var result = await _wallet.BetweenAccountsTransferAsync(CurrentUserId, req, ct);
        return result.IsSuccess ? Ok(result.Data) : StatusCode(result.StatusCode, new { error = result.Error });
    }

    /// <summary>Add 10,000 USDT demo balance</summary>
    [HttpPost("demo/topup")]
    public async Task<IActionResult> AddDemoBalance(CancellationToken ct)
    {
        var result = await _wallet.AddDemoBalanceAsync(CurrentUserId, ct);
        return Ok(result.Data);
    }

    /// <summary>Get transfer history</summary>
    [HttpGet("transfers")]
    public async Task<IActionResult> GetTransfers(CancellationToken ct)
    {
        var result = await _wallet.GetTransferHistoryAsync(CurrentUserId, ct);
        return Ok(result.Data);
    }
}
