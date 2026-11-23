import * as signalR from '@microsoft/signalr';

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private currentSymbol: string | null = null;

  public async connect(): Promise<signalR.HubConnection> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5000/hubs/exchange', {
        accessTokenFactory: () => localStorage.getItem('token') || '',
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    try {
      await this.connection.start();
      console.log('SignalR Connected to Exchange Hub');
    } catch (err) {
      console.warn('SignalR start failed (will retry automatically if server comes up)', err);
    }

    return this.connection;
  }

  public async subscribeMarket(symbol: string) {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    if (this.currentSymbol && this.currentSymbol !== symbol) {
      try {
        await this.connection.invoke('UnsubscribeFromMarket', this.currentSymbol);
      } catch {}
    }
    this.currentSymbol = symbol;
    try {
      await this.connection.invoke('SubscribeToMarket', symbol);
    } catch {}
  }

  public async subscribeUser(userId: string) {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.connection.invoke('SubscribeToUser', userId);
    } catch {}
  }

  public getConnection(): signalR.HubConnection | null {
    return this.connection;
  }
}

export const signalRService = new SignalRService();
