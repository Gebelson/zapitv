/**
 * ZapiTV - TrustedTimeService
 * Serviço de tempo confiável sincronizado com o servidor ZapiTV e horário de Brasília (America/Sao_Paulo).
 * 
 * Evita adulterações de relógio local pelo navegador e suporta injeção controlada de tempo para testes.
 */

export class TrustedTimeService {
  private static instance: TrustedTimeService;
  private serverOffsetMs = 0;
  private isSynchronized = false;
  private mockTimestamp: number | null = null;
  private syncPromise: Promise<void> | null = null;

  private constructor() {
    this.initSync();
  }

  public static getInstance(): TrustedTimeService {
    if (!TrustedTimeService.instance) {
      TrustedTimeService.instance = new TrustedTimeService();
    }
    return TrustedTimeService.instance;
  }

  /**
   * Sincroniza o relógio do cliente com o servidor
   */
  public async syncWithServer(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const before = Date.now();
      const res = await fetch('/api/time', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        const after = Date.now();
        const roundtrip = after - before;
        const serverEpoch = typeof data.epoch === 'number' ? data.epoch : Date.parse(data.iso || '');
        if (!isNaN(serverEpoch)) {
          // Ajusta a estimativa com metade do tempo de viagem da requisição
          this.serverOffsetMs = serverEpoch - (before + Math.floor(roundtrip / 2));
          this.isSynchronized = true;
        }
      }
    } catch {
      // Em caso de falha de rede ou ambiente offline, opera com offset 0 (relógio do sistema)
    }
  }

  private initSync(): void {
    if (typeof window !== 'undefined') {
      this.syncWithServer().catch(() => {});
      // Resincroniza periodicamente a cada 15 minutos
      setInterval(() => {
        this.syncWithServer().catch(() => {});
      }, 15 * 60 * 1000);
    }
  }

  /**
   * Retorna o timestamp confiável atual (em milissegundos)
   */
  public getNow(): number {
    if (this.mockTimestamp !== null) {
      return this.mockTimestamp;
    }
    return Date.now() + this.serverOffsetMs;
  }

  /**
   * Retorna o objeto Date confiável atual
   */
  public getDate(): Date {
    return new Date(this.getNow());
  }

  /**
   * Retorna a string ISO-8601 correspondente ao tempo confiável
   */
  public getIsoString(): string {
    return new Date(this.getNow()).toISOString();
  }

  /**
   * Define um timestamp simulado para fins de testes automatizados
   */
  public setMockTime(time: number | string | null): void {
    if (time === null) {
      this.mockTimestamp = null;
      return;
    }
    if (typeof time === 'string') {
      const parsed = Date.parse(time);
      if (isNaN(parsed)) throw new Error(`[TrustedTimeService] Data inválida para mock: ${time}`);
      this.mockTimestamp = parsed;
    } else {
      this.mockTimestamp = time;
    }
  }

  /**
   * Reseta qualquer mock de tempo ativo
   */
  public resetMockTime(): void {
    this.mockTimestamp = null;
  }
}

export const trustedTimeService = TrustedTimeService.getInstance();
